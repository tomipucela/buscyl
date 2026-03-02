function transporteApp() {
	return {
		tab: 'regulares',
		datos: [],
		datosMetro: [],
		qOrigen: '', qDestino: '', qProvincia: '',
		sugOrigen: [], sugDestino: [], sugProvincia: [],
		selectedIndex: -1,

		normalizar(texto) {
			if (!texto) return "";
			return String(texto)
				.toLowerCase()
				.trim()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/ñ/g, "n");
		},

async init() {
	try {
		const [r1, r2] = await Promise.all([
			fetch('data/reg.json').then(res => res.json()),
			fetch('data/metrop.json').then(res => res.json())
		]);
		this.datos = Array.isArray(r1) ? r1 : [];
		this.datosMetro = Array.isArray(r2) ? r2 : [];

		if (this.datos.length > 0) {
			// Extraemos todos los puntos
			const brutos = this.datos.flatMap(d => [d.ORIGEN, d.DESTINO]).filter(p => p && p.trim() !== "");
            
			// Lógica de unificación: Prioriza la versión con acentos
			const mapaUnificado = new Map();
			brutos.forEach(nombre => {
				const norm = this.normalizar(nombre);
				if (!mapaUnificado.has(norm)) {
					mapaUnificado.set(norm, nombre);
				} else {
					const existente = mapaUnificado.get(norm);
					// Si el nombre actual es diferente a su versión normalizada (tiene acentos)
					// y el que ya tenemos guardado NO los tiene, lo reemplazamos.
					if (nombre !== this.normalizar(nombre) && existente === this.normalizar(existente)) {
						mapaUnificado.set(norm, nombre);
					}
				}
			});

			const todosLosPuntos = Array.from(mapaUnificado.values()).sort((a, b) => a.localeCompare(b));

			console.log("%c BUSCADOR BUSCYL - LISTA UNIFICADA (CON ACENTOS) ", "background: #1e293b; color: #fbbf24; font-weight: bold; padding: 4px;");
			console.log("Localidades únicas encontradas:", todosLosPuntos.length);
			console.table(todosLosPuntos);
		}
	} catch (e) { 
		console.error("Error cargando archivos JSON", e); 
		this.datos = []; this.datosMetro = [];
	}
},

		resetInputs() {
			this.qOrigen = ''; this.qDestino = ''; this.qProvincia = '';
			this.sugOrigen = []; this.sugDestino = []; this.sugProvincia = [];
			this.selectedIndex = -1;
		},

buscarSugerencias(tipo) {
	this.selectedIndex = -1;
	const query = this.normalizar(tipo === 'origen' ? this.qOrigen : this.qDestino);
    
	let puntos = [];
	if(tipo === 'origen') {
		puntos = [...new Set(this.datos.flatMap(d => [d.ORIGEN, d.DESTINO]))].filter(p => p && p.trim() !== "");
	} else {
		const o = this.normalizar(this.qOrigen);
		puntos = [...new Set(
			this.datos.filter(d => {
				return d.ORIGEN && d.DESTINO && 
					   (this.normalizar(d.ORIGEN) === o || this.normalizar(d.DESTINO) === o);
			}).map(d => this.normalizar(d.ORIGEN) === o ? d.DESTINO : d.ORIGEN)
		)].filter(p => p && p.trim() !== "");
	}

	// Aplicar unificación de acentos antes de mostrar sugerencias
	const mapa = new Map();
	puntos.forEach(p => {
		const n = this.normalizar(p);
		if (!mapa.has(n) || (p !== n && mapa.get(n) === n)) {
			mapa.set(n, p);
		}
	});
    
	const listaFinal = Array.from(mapa.values());

	if(tipo === 'origen') {
		this.sugOrigen = query.length < 1 
			? listaFinal.sort((a, b) => a.localeCompare(b)) 
			: listaFinal.filter(p => this.normalizar(p).includes(query)).sort((a, b) => a.localeCompare(b));
	} else {
		this.sugDestino = query.length < 1 
			? listaFinal.sort((a, b) => a.localeCompare(b)) 
			: listaFinal.filter(p => this.normalizar(p).includes(query)).sort((a, b) => a.localeCompare(b));
	}
},
		buscarProvincia() {
			this.selectedIndex = -1;
			const query = this.normalizar(this.qProvincia);
			const provs = [...new Set(this.datosMetro.map(d => d.PROVINCIA))].filter(p => p);
			this.sugProvincia = query.length < 1 
				? provs.sort() 
				: provs.filter(p => this.normalizar(p).includes(query)).sort();
		},

		seleccionarProvincia(p) {
			this.qProvincia = p; this.sugProvincia = []; this.selectedIndex = -1;
		},

		navIndex(tipo, dir) {
			const list = tipo === 'origen' ? this.sugOrigen : (tipo === 'destino' ? this.sugDestino : this.sugProvincia);
			if (list.length === 0) return;
            
			// Actualizamos el índice
			this.selectedIndex = (this.selectedIndex + dir + list.length) % list.length;

			// Forzamos el scroll al elemento seleccionado
			this.$nextTick(() => {
				const container = document.querySelector('.sug-container:not([style*="display: none"])');
				if (container) {
					const selected = container.querySelector('.selected-item');
					if (selected) {
						selected.scrollIntoView({
							block: 'nearest', // Lo mueve solo lo necesario para que sea visible
							behavior: 'smooth' // Movimiento fluido
						});
					}
				}
			});
		},

		seleccionarConEnter(tipo) {
			const list = tipo === 'origen' ? this.sugOrigen : (tipo === 'destino' ? this.sugDestino : this.sugProvincia);
			if (this.selectedIndex >= 0 && list[this.selectedIndex]) {
				if(tipo === 'provincia') this.seleccionarProvincia(list[this.selectedIndex]);
				else this.seleccionar(tipo, list[this.selectedIndex]);
			}
		},

		seleccionar(tipo, valor) {
			if(tipo === 'origen') { 
				this.qOrigen = valor; this.sugOrigen = []; this.qDestino = ''; this.selectedIndex = -1;
				this.$nextTick(() => { if(this.$refs.inputDestino) this.$refs.inputDestino.focus(); });
			} else { 
				this.qDestino = valor; this.sugDestino = []; this.selectedIndex = -1; 
			}
		},

		get filtrarRegulares() {
			if(!this.qOrigen || !this.qDestino || this.datos.length === 0) return [];
            
			const oBusqueda = this.normalizar(this.qOrigen);
			const dBusqueda = this.normalizar(this.qDestino);
            
			return this.datos
				.filter(r => {
					if (!r.ORIGEN || !r.DESTINO) return false;
					const rOr = this.normalizar(r.ORIGEN);
					const rDe = this.normalizar(r.DESTINO);
					// Mantenemos el filtro de ambos sentidos
					return (rOr === oBusqueda && rDe === dBusqueda) || (rOr === dBusqueda && rDe === oBusqueda);
				})
				.sort((a, b) => {
					// Lógica de ordenación:
					const aEsDirecto = (this.normalizar(a.ORIGEN) === oBusqueda && this.normalizar(a.DESTINO) === dBusqueda);
					const bEsDirecto = (this.normalizar(b.ORIGEN) === oBusqueda && this.normalizar(b.DESTINO) === dBusqueda);

					if (aEsDirecto && !bEsDirecto) return -1; // 'a' va arriba
					if (!aEsDirecto && bEsDirecto) return 1;  // 'b' va arriba
					return 0; // Si ambos son del mismo sentido, se quedan como están
				});
		},

		get filtrarMetro() {
			if(!this.qProvincia || this.datosMetro.length === 0) return [];
			const pBusqueda = this.normalizar(this.qProvincia);
			return this.datosMetro.filter(m => m.PROVINCIA && this.normalizar(m.PROVINCIA) === pBusqueda);
		}
	}
}
