library(jsonlite)
library(dplyr)

# Cargar rutas regulares desde JSON
rutas_reg <- fromJSON("C:/Users/tomip/OneDrive/Documentos/buscyl/reg.json", simplifyVector = FALSE)

# Verificar que sea lista
if (!is.list(rutas_reg) || length(rutas_reg) == 0) stop("reg.json no contiene rutas válidas")

# Convertir lista a data.frame
df_rutas <- bind_rows(lapply(rutas_reg, as.data.frame))

# Columnas a comparar aparte de ORIGEN y DESTINO
otras_cols <- setdiff(names(df_rutas), c("ORIGEN","DESTINO"))

# Función para marcar duplicados, conservando solo la primera ocurrencia
mark_duplicates_keep_one <- function(df) {
  n <- nrow(df)
  dup_flags <- logical(n)
  
  for (i in 1:(n-1)) {
    if (dup_flags[i]) next  # Ya marcado, saltar
    for (j in (i+1):n) {
      if (dup_flags[j]) next  # Ya marcado, saltar
      # Directo
      direct <- (df$ORIGEN[i] == df$ORIGEN[j] & df$DESTINO[i] == df$DESTINO[j]) &&
        all(df[i, otras_cols] == df[j, otras_cols], na.rm = TRUE)
      # Invertido
      inverted <- (df$ORIGEN[i] == df$DESTINO[j] & df$DESTINO[i] == df$ORIGEN[j]) &&
        all(df[i, otras_cols] == df[j, otras_cols], na.rm = TRUE)
      if (!is.na(direct) && !is.na(inverted) && (direct || inverted)) {
        dup_flags[j] <- TRUE  # Solo marcar la segunda (j) como duplicado
      }
    }
  }
  return(dup_flags)
}

# Obtener flags de duplicados
dup_flags <- mark_duplicates_keep_one(df_rutas)

# Rutas únicas (conservando la primera de cada duplicado)
rutas_unicas <- df_rutas[!dup_flags, ]

# Rutas eliminadas (segundas de duplicados)
rutas_eliminadas <- df_rutas[dup_flags, ]
cat("Número de rutas duplicadas eliminadas:", nrow(rutas_eliminadas), "\n")
print(rutas_eliminadas)

# Guardar JSON con rutas únicas
write_json(rutas_unicas, 
           "C:/Users/tomip/OneDrive/Documentos/buscyl/reg_sin_duplicados.json", 
           pretty = TRUE, auto_unbox = TRUE)
cat("Rutas únicas guardadas en reg_sin_duplicados.json\n")