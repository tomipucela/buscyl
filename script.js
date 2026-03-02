function transporteApp() {
	return {
		tab: 'regulares',
		datos: [],
		datosMetro: [],
		qOrigen: '',
		qDestino: '',
		qProvincia: '',
		sugOrigen: [],
		sugDestino: [],
		sugProvincia: [],
		selectedIndex: -1,

		normalizar(texto) {
			if (!texto) return '';
			return String(texto)
				.toLowerCase()
				.trim()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/ñ/g, 'n');
		},

		async init() {
			try {
				const [rutasRegulares, rutasMetro] = await Promise.all([
					fetch('data/reg.json').then(respuesta => respuesta.json()),
					fetch('data/metrop.json').then(respuesta => respuesta.json())
				]);

				this.datos = Array.isArray(rutasRegulares) ? rutasRegulares : [];
				this.datosMetro = Array.isArray(rutasMetro) ? rutasMetro : [];
			} catch (error) {
				console.error('Error cargando archivos JSON', error);
				this.datos = [];
				this.datosMetro = [];
			}
		},

		resetInputs() {
			this.qOrigen = '';
			this.qDestino = '';
			this.qProvincia = '';
			this.sugOrigen = [];
			this.sugDestino = [];
			this.sugProvincia = [];
			this.selectedIndex = -1;
		},

		buscarSugerencias(tipo) {
			this.selectedIndex = -1;
			const query = this.normalizar(tipo === 'origen' ? this.qOrigen : this.qDestino);

			let puntosDisponibles = [];

			if (tipo === 'origen') {
				puntosDisponibles = [...new Set(this.datos.flatMap(ruta => [ruta.ORIGEN, ruta.DESTINO]))]
					.filter(punto => punto && punto.trim() !== '');
			} else {
				const origenNormalizado = this.normalizar(this.qOrigen);
				puntosDisponibles = [...new Set(
					this.datos
						.filter(ruta => {
							return ruta.ORIGEN && ruta.DESTINO && (
								this.normalizar(ruta.ORIGEN) === origenNormalizado ||
								this.normalizar(ruta.DESTINO) === origenNormalizado
							);
						})
						.map(ruta => this.normalizar(ruta.ORIGEN) === origenNormalizado ? ruta.DESTINO : ruta.ORIGEN)
				)].filter(punto => punto && punto.trim() !== '');
			}

			const unificados = new Map();
			puntosDisponibles.forEach(punto => {
				const puntoNormalizado = this.normalizar(punto);
				if (!unificados.has(puntoNormalizado) || (punto !== puntoNormalizado && unificados.get(puntoNormalizado) === puntoNormalizado)) {
					unificados.set(puntoNormalizado, punto);
				}
			});

			const resultados = Array.from(unificados.values());
			const resultadosFiltrados = query.length < 1
				? resultados.sort((a, b) => a.localeCompare(b))
				: resultados
					.filter(punto => this.normalizar(punto).includes(query))
					.sort((a, b) => a.localeCompare(b));

			if (tipo === 'origen') {
				this.sugOrigen = resultadosFiltrados;
			} else {
				this.sugDestino = resultadosFiltrados;
			}
		},

		buscarProvincia() {
			this.selectedIndex = -1;
			const query = this.normalizar(this.qProvincia);
			const provincias = [...new Set(this.datosMetro.map(ruta => ruta.PROVINCIA))].filter(Boolean);

			this.sugProvincia = query.length < 1
				? provincias.sort()
				: provincias.filter(provincia => this.normalizar(provincia).includes(query)).sort();
		},

		seleccionarProvincia(provincia) {
			this.qProvincia = provincia;
			this.sugProvincia = [];
			this.selectedIndex = -1;
		},

		navIndex(tipo, direccion) {
			const listaActiva = tipo === 'origen'
				? this.sugOrigen
				: (tipo === 'destino' ? this.sugDestino : this.sugProvincia);

			if (listaActiva.length === 0) return;

			this.selectedIndex = (this.selectedIndex + direccion + listaActiva.length) % listaActiva.length;

			this.$nextTick(() => {
				const contenedor = document.querySelector('.sug-container:not([style*="display: none"])');
				if (!contenedor) return;

				const elementoSeleccionado = contenedor.querySelector('.selected-item');
				if (!elementoSeleccionado) return;

				elementoSeleccionado.scrollIntoView({
					block: 'nearest',
					behavior: 'smooth'
				});
			});
		},

		seleccionarConEnter(tipo) {
			const listaActiva = tipo === 'origen'
				? this.sugOrigen
				: (tipo === 'destino' ? this.sugDestino : this.sugProvincia);

			if (this.selectedIndex < 0 || !listaActiva[this.selectedIndex]) return;

			if (tipo === 'provincia') {
				this.seleccionarProvincia(listaActiva[this.selectedIndex]);
			} else {
				this.seleccionar(tipo, listaActiva[this.selectedIndex]);
			}
		},

		seleccionar(tipo, valor) {
			if (tipo === 'origen') {
				this.qOrigen = valor;
				this.sugOrigen = [];
				this.qDestino = '';
				this.selectedIndex = -1;

				this.$nextTick(() => {
					if (this.$refs.inputDestino) {
						this.$refs.inputDestino.focus();
					}
				});
				return;
			}

			this.qDestino = valor;
			this.sugDestino = [];
			this.selectedIndex = -1;
		},

		get filtrarRegulares() {
			if (!this.qOrigen || !this.qDestino || this.datos.length === 0) return [];

			const origenBuscado = this.normalizar(this.qOrigen);
			const destinoBuscado = this.normalizar(this.qDestino);

			return this.datos
				.filter(ruta => {
					if (!ruta.ORIGEN || !ruta.DESTINO) return false;

					const origenRuta = this.normalizar(ruta.ORIGEN);
					const destinoRuta = this.normalizar(ruta.DESTINO);

					return (origenRuta === origenBuscado && destinoRuta === destinoBuscado) ||
						(origenRuta === destinoBuscado && destinoRuta === origenBuscado);
				})
				.sort((rutaA, rutaB) => {
					const aDirecta = this.normalizar(rutaA.ORIGEN) === origenBuscado && this.normalizar(rutaA.DESTINO) === destinoBuscado;
					const bDirecta = this.normalizar(rutaB.ORIGEN) === origenBuscado && this.normalizar(rutaB.DESTINO) === destinoBuscado;

					if (aDirecta && !bDirecta) return -1;
					if (!aDirecta && bDirecta) return 1;
					return 0;
				});
		},

		get filtrarMetro() {
			if (!this.qProvincia || this.datosMetro.length === 0) return [];

			const provinciaBuscada = this.normalizar(this.qProvincia);
			return this.datosMetro.filter(ruta => ruta.PROVINCIA && this.normalizar(ruta.PROVINCIA) === provinciaBuscada);
		}
	};
}
