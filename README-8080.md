# Intel 8080 CPU Emulator & Assembler - Version 2.1.0

Bienvenidos al emulador y ensamblador de la arquitectura Intel 8080. Este proyecto ha sido construido desde cero utilizando tecnología 100% web pura (HTML5, CSS3 y Vanilla JavaScript) sin frameworks ni dependencias de ningún tipo, garantizando una carga instantánea y la máxima compatibilidad educativa.

---

## 🌟 ¿Por qué nació este proyecto? (Historia y Propósito)

En la enseñanza de la informática y la ingeniería de sistemas, existe una brecha pedagógica crítica al transicionar de lenguajes de alto nivel (como Python, Java o JavaScript) al entendimiento del hardware real. Los simuladores tradicionales de bajo nivel suelen ser difíciles de instalar, tienen interfaces obsoletas o carecen de feedback visual inmediato.

**Este simulador nació con el propósito de resolver este problema.** Su objetivo es democratizar la enseñanza de la arquitectura de computadoras proporcionando un entorno gráfico intuitivo, interactivo y moderno. Permite a los estudiantes "ver dentro" de una unidad central de procesamiento (CPU): observar cómo cambian los registros paso a paso, cómo fluyen los datos en la memoria RAM y cómo se comportan las banderas de estado (*flags*) en respuesta a operaciones aritméticas elementales.

---

## 🛠️ ¿Para qué sirve?

*   **Enseñanza Didáctica y Práctica:** Ideal para profesores y estudiantes de ciencias de la computación que desean experimentar la programación en lenguaje ensamblador sin la fricción de instalar herramientas en sistemas operativos locales.
*   **Visualización de Flujo de Datos:** El panel interactivo permite observar las dinámicas de:
    *   Los registros de propósito general y específicos.
    *   Las operaciones de pila (*Stack*) con seguimiento visual directo de la dirección apuntada por `SP`.
    *   La memoria RAM desglosada en un mapa bidimensional interactivo con localización instantánea.
*   **Depuración Paso a Paso (*Debugging*):** Permite ejecutar programas instrucción por instrucción, deteniendo y analizando el procesador para encontrar errores de lógica con facilidad.

---

## 🚀 Novedades de la Versión 2.1.0

Esta versión representa un gran salto adelante en la calidad del entorno de desarrollo web:
- **Visualizador de Pila (*Stack View*):** Un componente visual que muestra los valores de 16 bits y bytes individuales que se encuentran en las posiciones de memoria alrededor de la dirección del puntero de pila (`SP`).
- **Banderas Explicadas (*Tooltips*):** Al colocar el puntero del ratón sobre cualquiera de las banderas de estado (`S`, `Z`, `AC`, `P`, `CY`), se muestra un tooltip detallado en español explicando su lógica.
- **Botón Clear Code:** Permite vaciar el editor del ensamblador y sus salidas con un solo clic.
- **Reset Profundo:** Al reiniciar el CPU, se limpia la memoria por completo (rellenando con ceros), se resetean todos los registros, banderas y el visor de memoria se restablece a la dirección inicial `0000`.

---

## 📦 Características Principales

*   **Núcleo de CPU Intel 8080 Completo:**
    *   Emulación fiel del juego de instrucciones.
    *   Gestión precisa de banderas (Sign, Zero, Auxiliary Carry, Parity, Carry).
    *   Soporte completo de la instrucción decimal `DAA`.
*   **Ensamblador Integrado:**
    *   Soporta mnemónicos estándar, etiquetas (labels) y comentarios.
    *   Directivas especiales como `ORG` (Origin) y `DB` (Define Byte).
    *   Soporta alias de registros dobles (`BC`, `DE`, `HL`).
*   **Cuadro de Mando Visual (Dashboard):**
    *   Registros en tiempo real.
    *   Estado del CPU (Ejecutando, En pausa, Halted).
*   **Mapa de Memoria Dinámico:**
    *   Visor de memoria con búsqueda hexadecimal y marcado de color para la posición actual del Program Counter (`PC`).

---

## 💻 Guía de Inicio Rápido

Para utilizar el emulador de forma local en tu máquina o para desarrollo:

1. **Clonar o descargar** este repositorio.
2. Servir el proyecto localmente mediante cualquier servidor web estático. Por ejemplo, si tienes Python instalado, ejecuta en la terminal de la raíz:
   ```bash
   python3 -m http.server 8000
   ```
3. Abre tu navegador e ingresa a `http://localhost:8000`.
4. ¡Comienza a escribir código ensamblador, presiona **Assemble & Load**, y ejecuta tu programa con **Run** o **Step**!

---

## 📝 Documentación Recomendada

*   **`INSTRUCTIONS.md`:** Nuestro libro didáctico interactivo diseñado específicamente para que los estudiantes de alto nivel aprendan el funcionamiento práctico del ensamblador paso a paso, con guías estructuradas de aritmética, ciclos, condicionales y la pila.

---
**Versión del Proyecto:** 2.1.0
**Licencia:** MIT
