library(readxl)
library(tidyverse)
library(stringr)
library(jsonlite)

# --- 1. CONFIGURACIÓN DE RUTAS ---
# Definimos la carpeta base para que sea más fácil de gestionar
folder_path <- "C:/Users/tomip/OneDrive/Documentos/buscyl/"
if (!dir.exists(folder_path)) dir.create(folder_path) # Crea la carpeta si no existe

# --- 2. FUNCIÓN DE LIMPIEZA Y EXTRACCIÓN ---
limpiar_y_extraer_obs <- function(ruta_sucia) {
  if (is.na(ruta_sucia)) return(list(ruta = NA, obs = NA))
  
  texto <- ruta_sucia
  obs_acumuladas <- c()
  
  # A. Extraer y ELIMINAR paréntesis
  parens <- str_extract_all(texto, "\\((.*?)\\)")[[1]]
  if (length(parens) > 0) {
    obs_acumuladas <- c(obs_acumuladas, str_replace_all(parens, "[()]", ""))
    texto <- str_remove_all(texto, "\\(.*?\\)")
  }
  
  # B. Extraer y ELIMINAR lo que va tras la coma
  if (str_detect(texto, ",")) {
    partes_coma <- str_split(texto, ",", n = 2)[[1]]
    texto <- partes_coma[1]
    if (length(partes_coma) > 1) {
      obs_acumuladas <- c(obs_acumuladas, trimws(partes_coma[2]))
    }
  }
  
  # C. Limpieza final de la ruta y Formato Título (Mayúsculas)
  ruta_limpia <- texto %>%
    str_replace_all("\\s+", " ") %>% 
    str_trim() %>%
    str_remove("[:punct:]$") %>% 
    str_to_title() %>%         # <--- AQUÍ: Convierte a "Aranda De Duero"
    str_trim()
  
  observaciones <- if(length(obs_acumuladas) > 0) paste(unique(obs_acumuladas), collapse = "; ") else NA_character_
  
  return(list(ruta = ruta_limpia, obs = observaciones))
}

# --- 3. CARGA Y PROCESAMIENTO ---
datos_raw <- read_excel(paste0(folder_path, "buscyl2.xlsx"))
datos_raw <- datos_raw[,-2]

procesar_todo <- function(df) {
  df_limpio <- df %>%
    mutate(TIPO = case_when(
      TIPO %in% c("Metrop.", "metropolitano") ~ "Metropolitano",
      TIPO %in% c("regular", "Regular") ~ "Regular",
      TRUE ~ TIPO
    ))
  
  resultados <- list()
  
  for (i in 1:nrow(df_limpio)) {
    limpieza <- limpiar_y_extraer_obs(df_limpio$RUTA[i])
    ruta_base <- limpieza$ruta
    obs_base <- limpieza$obs
    
    if (df_limpio$TIPO[i] == "Metropolitano") {
      resultados[[i]] <- tibble(
        ORIGEN = NA_character_, DESTINO = NA_character_,
        RUTA = ruta_base, CONCESIÓN = df_limpio$CONCESIÓN[i],
        OPERADOR = df_limpio$OPERADOR[i], TIPO = "Metropolitano",
        OBSERVACIONES = obs_base
      )
    } else {
      # Separar por guiones (la ruta_base ya viene en Mayúsculas de la función anterior)
      puntos <- str_split(ruta_base, "-")[[1]] %>% str_trim() %>% .[. != ""]
      n <- length(puntos)
      
      if (n >= 2) {
        tramos_fila <- list()
        for (idx_o in 1:(n-1)) {
          for (idx_d in (idx_o + 1):n) {
            tramos_fila[[length(tramos_fila) + 1]] <- tibble(
              ORIGEN = puntos[idx_o],
              DESTINO = puntos[idx_d],
              RUTA = ruta_base,
              CONCESIÓN = df_limpio$CONCESIÓN[i],
              OPERADOR = df_limpio$OPERADOR[i],
              TIPO = "Regular",
              OBSERVACIONES = obs_base
            )
          }
        }
        resultados[[i]] <- bind_rows(tramos_fila)
      } else {
        resultados[[i]] <- tibble(
          ORIGEN = ruta_base, DESTINO = NA_character_,
          RUTA = ruta_base, CONCESIÓN = df_limpio$CONCESIÓN[i],
          OPERADOR = df_limpio$OPERADOR[i], TIPO = "Regular",
          OBSERVACIONES = obs_base
        )
      }
    }
  }
  return(bind_rows(resultados))
}

# --- 4. EJECUCIÓN Y GUARDADO ---
final_df <- procesar_todo(datos_raw) %>% distinct()

# Filtrar y Limpiar columnas para exportar
regulares_out <- final_df %>% 
  filter(TIPO == "Regular") %>%
  select(ORIGEN, DESTINO, CONCESIÓN, OPERADOR, TIPO, OBSERVACIONES)

metrop_out <- final_df %>% 
  filter(TIPO == "Metropolitano") %>%
  select(RUTA, CONCESIÓN, OPERADOR, OBSERVACIONES)

# Guardar en la carpeta buscyl
write_json(regulares_out, paste0(folder_path, "tramos_regulares_final.json"), pretty = TRUE, auto_unbox = TRUE)
write_json(metrop_out, paste0(folder_path, "metropolitano.json"), pretty = TRUE, auto_unbox = TRUE)
write.csv(regulares_out, paste0(folder_path, "tramos_regulares_final.csv"), row.names = FALSE, fileEncoding = "UTF-8")

cat("✅ Archivos generados en:", folder_path)