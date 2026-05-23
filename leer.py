import os

def compactar_proyecto(ruta_raiz, archivo_salida):
    # 1. Carpetas que no queremos ni abrir
    carpetas_ignorar = {'.git', '__pycache__', '.venv', 'node_modules', '.idea', '.vscode'}
    
    # 2. Archivos exactos que queremos saltar
    archivos_ignorar = {'leer.py', archivo_salida, 'README.md', '.gitignore','package-lock.json', 'index.html'}
    
    # 3. Extensiones que queremos omitir
    extensiones_ignorar = {'.txt', '.exe', '.pyc', '.png', '.jpg', '.pdf', '.webp', '.mp3'}

    print(f"--- Iniciando compactación en: {archivo_salida} ---")

    with open(archivo_salida, 'w', encoding='utf-8') as f_salida:
        for raiz, carpetas, archivos in os.walk(ruta_raiz):
            # Filtrar directorios pesados
            carpetas[:] = [d for d in carpetas if d not in carpetas_ignorar]
            
            for nombre_archivo in archivos:
                extension = os.path.splitext(nombre_archivo)[1].lower()
                
                # Reglas de exclusión
                if nombre_archivo in archivos_ignorar:
                    continue
                if extension in extensiones_ignorar:
                    continue
                
                ruta_completa = os.path.join(raiz, nombre_archivo)
                ruta_relativa = os.path.relpath(ruta_completa, ruta_raiz)
                
                try:
                    # 'errors=ignore' ayuda si hay caracteres extraños en archivos de texto
                    with open(ruta_completa, 'r', encoding='utf-8', errors='ignore') as f_entrada:
                        contenido = f_entrada.read()
                        
                        # Separador visual y jerarquía
                        f_salida.write("\n" + "#" * 60 + "\n")
                        f_salida.write(f"### ARCHIVO: {ruta_relativa}\n")
                        f_salida.write("#" * 60 + "\n\n")
                        
                        f_salida.write(contenido)
                        f_salida.write("\n")
                        
                except Exception as e:
                    print(f"Error leyendo {ruta_relativa}: {e}")

if __name__ == "__main__":
    # Configuración local
    directorio_objetivo = "." 
    archivo_final = "resumen_codigo.txt" # Aunque ignore .txt, este se crea después o se excluye por nombre
    
    compactar_proyecto(directorio_objetivo, archivo_final)
    print(f"\nProceso finalizado. El archivo '{archivo_final}' ha sido generado.")