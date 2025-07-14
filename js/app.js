document.addEventListener('DOMContentLoaded', initSimulador);

function initSimulador() {
    cargarHistorial();
    setupEventListeners();
    updateTasaValue();
}

function setupEventListeners() {
    const $form = document.getElementById('prestamo-form');
    const $limpiarBtn = document.getElementById('limpiar-btn');
    const $compararBtn = document.getElementById('comparar-btn');
    const $verHistorialBtn = document.getElementById('ver-historial-btn');
    const $vaciarHistorialBtn = document.getElementById('vaciar-historial-btn');
    const $tasaSlider = document.getElementById('tasa');

    if ($form) $form.addEventListener('submit', handleSubmit);
    if ($limpiarBtn) $limpiarBtn.addEventListener('click', limpiarDatos);
    if ($compararBtn) $compararBtn.addEventListener('click', compararEscenarios);
    if ($verHistorialBtn) $verHistorialBtn.addEventListener('click', verHistorial);
    if ($vaciarHistorialBtn) $vaciarHistorialBtn.addEventListener('click', vaciarHistorial);
    if ($tasaSlider) $tasaSlider.addEventListener('input', updateTasaValue);
}


function handleSubmit(e) {
    e.preventDefault();

    const datosForm = obtenerDatosFormulario();

    if (validarDatos(datosForm)) {
        const amortizacion = generarAmortizacion(datosForm);
        const resumen = calcularResumen(amortizacion, datosForm);

        mostrarResultados(resumen, amortizacion);
        guardarSimulacion(resumen);

        // ✅ Mostrar Toastify sólo si se simula correctamente
        Toastify({
            text: "¡Simulación realizada con éxito!",
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "#28a745"
        }).showToast();
    }
}

function obtenerDatosFormulario() {
    const elementos = Array.from(document.querySelectorAll('#prestamo-form input, #prestamo-form select'));

    return elementos.reduce((acc, elemento) => {
        const key = elemento.id;
        let value = elemento.value;

        if (elemento.type === 'checkbox') {
            value = elemento.checked;
        } else if (elemento.type === 'number') {
            value = parseFloat(value) || 0;
        }

        return { ...acc, [key]: value };
    }, {});
}

function validarDatos(datos) {
    const errores = [];

    if (!datos.monto || datos.monto <= 0) {
        errores.push('El monto debe ser mayor a cero');
    }

    if (!datos.plazo || datos.plazo <= 0) {
        errores.push('El plazo debe ser mayor a cero');
    }

    if (errores.length > 0) {
        mostrarErrores(errores);
        return false;
    }

    return true;
}

function generarAmortizacion(datos) {
    const { monto, plazo, tasa, periodoGracia, seguro, pagoExtra } = datos;
    const tasaMensual = tasa / 12 / 100;
    let saldo = monto;

    return Array.from({ length: plazo }).map((_, mes) => {
        const mesActual = mes + 1;
        const interes = saldo * tasaMensual;
        let capital = 0;

        if (!periodoGracia || mesActual > 3) {
            const cuotaBase = calcularCuota(monto, plazo, tasaMensual, periodoGracia);
            capital = cuotaBase - interes;
            saldo -= capital;
        }

        const cuotaTotal = interes + capital + (seguro || 0) + (pagoExtra || 0);

        return {
            mes: mesActual,
            cuotaTotal,
            capital,
            interes,
            seguro,
            pagoExtra,
            saldoRestante: Math.max(saldo, 0)
        };
    });
}

function calcularCuota(monto, plazo, tasaMensual, periodoGracia) {
    if (periodoGracia) {
        return monto * tasaMensual;
    }
    const factor = Math.pow(1 + tasaMensual, plazo);
    return (monto * tasaMensual * factor) / (factor - 1);
}

function calcularResumen(amortizacion, datos) {
    const totalIntereses = amortizacion.reduce((sum, fila) => sum + fila.interes, 0);
    const totalPagado = amortizacion.reduce((sum, fila) => sum + fila.cuotaTotal, 0);

    return {
        ...datos,
        totalIntereses,
        totalPagado,
        costoTotalSeguro: (datos.seguro || 0) * datos.plazo,
        fechaSimulacion: new Date().toLocaleString()
    };
}

function mostrarResultados(resumen, amortizacion) {
    mostrarResumen(resumen);
    mostrarAmortizacion(amortizacion);
}

function mostrarResumen(resumen) {
    const $resumenContainer = document.getElementById('resumen-container');
    if (!$resumenContainer) return;

    $resumenContainer.innerHTML = `
    <div class="resumen-card">
      <h3>Resumen del Préstamo</h3>
      <div class="resumen-grid">
        ${Object.entries({
            'Monto solicitado': `$${resumen.monto.toLocaleString()}`,
            'Plazo': `${resumen.plazo} meses`,
            'Tasa anual': `${resumen.tasa}%`,
            'Cuota estimada': `$${resumen.cuotaPromedio?.toLocaleString() || calcularCuota(resumen.monto, resumen.plazo, resumen.tasa / 12 / 100, resumen.periodoGracia).toLocaleString()}`,
            'Total a pagar': `$${resumen.totalPagado.toLocaleString()}`,
            'Intereses totales': `$${resumen.totalIntereses.toLocaleString()}`
        }).map(([key, value]) => `
          <div class="resumen-item">
            <span>${key}:</span>
            <span>${value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function mostrarAmortizacion(amortizacion) {
    const $amortizacionContainer = document.getElementById('amortizacion-container');
    if (!$amortizacionContainer) return;

    const mesesMostrar = [
        ...amortizacion.slice(0, 5),
        ...(amortizacion.length > 10 ? [{ mes: '...' }] : []),
        ...amortizacion.slice(-5)
    ];

    $amortizacionContainer.innerHTML = `
    <div class="table-container">
      <h3>Tabla de Amortización (Resumen)</h3>
      <table class="amortizacion-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Cuota</th>
            <th>Capital</th>
            <th>Interés</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${mesesMostrar.map(fila =>
            fila.mes === '...' ?
                '<tr><td colspan="5" class="separator">...</td></tr>' :
                `
                  <tr>
                    <td>${fila.mes}</td>
                    <td>$${fila.cuotaTotal.toFixed(2)}</td>
                    <td>$${fila.capital.toFixed(2)}</td>
                    <td>$${fila.interes.toFixed(2)}</td>
                    <td>$${fila.saldoRestante.toFixed(2)}</td>
                  </tr>
                `
        ).join('')}
        </tbody>
      </table>
      <button id="exportar-btn" class="btn secondary">Exportar a CSV</button>
      <button id="ver-completa-btn" class="btn">Ver tabla completa</button>
    </div>
  `;

    document.getElementById('exportar-btn')?.addEventListener('click', () => exportarACSV(amortizacion));
    document.getElementById('ver-completa-btn')?.addEventListener('click', () => mostrarTablaCompleta(amortizacion));
}

function guardarSimulacion(resumen) {
    const historial = obtenerHistorial();
    historial.push(resumen);
    localStorage.setItem('historialPrestamos', JSON.stringify(historial));
}

function obtenerHistorial() {
    return JSON.parse(localStorage.getItem('historialPrestamos')) || [];
}

function cargarHistorial() {
    const historial = obtenerHistorial();
    if (historial.length > 0) {
        console.log('Historial cargado:', historial);
    }
}

function compararEscenarios() {
    const historial = obtenerHistorial().slice(-2);

    if (historial.length < 2) {
        mostrarErrores(['Necesitás al menos 2 préstamos simulados para comparar.']);
        return;
    }

    const rows = ['totalPagado', 'totalIntereses', 'costoTotalSeguro'].map(key => {
        return `
          <tr>
            <td><strong>${formatKey(key)}</strong></td>
            <td>$${historial[0][key]?.toLocaleString() || 'N/A'}</td>
            <td>$${historial[1][key]?.toLocaleString() || 'N/A'}</td>
          </tr>
        `;
    }).join('');

    Swal.fire({
        title: 'Comparación de Escenarios',
        html: `
          <div class="table-responsive">
            <table class="table table-bordered table-striped">
              <thead class="table-success">
                <tr>
                  <th>Concepto</th>
                  <th>Préstamo 1</th>
                  <th>Préstamo 2</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `,
        width: '60%',
        confirmButtonText: 'Cerrar',
        customClass: {
            popup: 'swal-wide'
        }
    });
}


function updateTasaValue() {
    const $tasaSlider = document.getElementById('tasa');
    const $tasaValue = document.getElementById('tasa-value');

    if ($tasaSlider && $tasaValue) {
        $tasaValue.textContent = `${$tasaSlider.value}%`;
    }
}

function limpiarDatos() {
    Swal.fire({
        title: "¿Estás seguro?",
        text: "Se borrarán todos los datos del formulario.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sí, borrar"
    }).then((result) => {
        if (result.isConfirmed) {
            const $form = document.getElementById('prestamo-form');
            const $resumenContainer = document.getElementById('resumen-container');
            const $amortizacionContainer = document.getElementById('amortizacion-container');
            const $comparacionContainer = document.getElementById('comparacion-container');

            if ($form) $form.reset();
            if ($resumenContainer) $resumenContainer.innerHTML = '';
            if ($amortizacionContainer) $amortizacionContainer.innerHTML = '';
            if ($comparacionContainer) $comparacionContainer.innerHTML = '';

            updateTasaValue();
        }
    });
}

function mostrarErrores(errores) {
    const $resultados = document.getElementById('resultados');
    if (!$resultados) return;

    const erroresHTML = errores.map(error => `<div class="error">${error}</div>`).join('');

    $resultados.insertAdjacentHTML('afterbegin', `
    <div class="alert alert-danger">
      <h4>Errores encontrados:</h4>
      ${erroresHTML}
    </div>
  `);

    setTimeout(() => {
        const $alert = document.querySelector('.alert');
        if ($alert) $alert.remove();
    }, 5000);
}

function mostrarTablaCompleta(amortizacion) {
    const ventana = window.open('', '_blank', 'width=1000,height=600,scrollbars=yes');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tabla de Amortización Completa</title>
      <style>
        :root {
          --color-primario: #9D8DFF;
          --color-secundario: #6F63B0;
          --color-resaltado: #FBE29D;
          --color-fondo: #EDEDF0;
          --color-texto: #3D3D4E;
          --color-blanco: #FFFFFF;
        }

        body {
          font-family: 'Segoe UI', sans-serif;
          background-color: var(--color-fondo);
          color: var(--color-texto);
          margin: 20px;
        }

        h1 {
          color: var(--color-primario);
          text-align: center;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th {
          background-color: var(--color-primario);
          color: white;
          padding: 10px;
          text-align: left;
        }

        td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
          background-color: var(--color-blanco);
        }

        tr:nth-child(even) td {
          background-color: #f6f4ff;
        }

        .total-row td {
          font-weight: bold;
          background-color: var(--color-resaltado);
        }

        .btn-container {
          text-align: center;
          margin-top: 20px;
        }

        .btn-container button {
          padding: 10px 20px;
          margin: 0 10px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        }

        .btn-print {
          background-color: var(--color-secundario);
          color: white;
        }

        .btn-close {
          background-color: #ff6b6b;
          color: white;
        }

        .btn-print:hover {
          background-color: #8566e0;
        }

        .btn-close:hover {
          background-color: #e44d4d;
        }
      </style>
    </head>
    <body>
      <h1>Tabla de Amortización Completa</h1>
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Cuota Total</th>
            <th>Capital</th>
            <th>Interés</th>
            <th>Seguro</th>
            <th>Pago Extra</th>
            <th>Saldo Restante</th>
          </tr>
        </thead>
        <tbody>
          ${amortizacion.map(fila => `
            <tr>
              <td>${fila.mes}</td>
              <td>$${fila.cuotaTotal.toFixed(2)}</td>
              <td>$${fila.capital.toFixed(2)}</td>
              <td>$${fila.interes.toFixed(2)}</td>
              <td>$${fila.seguro?.toFixed(2) || '0.00'}</td>
              <td>$${fila.pagoExtra?.toFixed(2) || '0.00'}</td>
              <td>$${fila.saldoRestante.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2">Totales</td>
            <td>$${amortizacion.reduce((sum, f) => sum + f.capital, 0).toFixed(2)}</td>
            <td>$${amortizacion.reduce((sum, f) => sum + f.interes, 0).toFixed(2)}</td>
            <td>$${amortizacion.reduce((sum, f) => sum + (f.seguro || 0), 0).toFixed(2)}</td>
            <td>$${amortizacion.reduce((sum, f) => sum + (f.pagoExtra || 0), 0).toFixed(2)}</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>

      <div class="btn-container">
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
        <button class="btn-close" onclick="window.close()">❌ Cerrar</button>
      </div>
    </body>
    </html>
  `;

    ventana.document.write(html);
    ventana.document.close();
}

function exportarACSV(amortizacion) {
    let csv = "Mes,Cuota,Capital,Interes,Seguro,Pago Extra,Saldo\n";

    csv += amortizacion.map(fila =>
        `${fila.mes},${fila.cuotaTotal},${fila.capital},${fila.interes},${fila.seguro},${fila.pagoExtra},${fila.saldoRestante}`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amortizacion_prestamo.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function formatKey(key) {
    const words = key.replace(/([A-Z])/g, ' $1');
    return words.charAt(0).toUpperCase() + words.slice(1);
}


function verHistorial() {
    const historial = obtenerHistorial();

    if (historial.length === 0) {
        Swal.fire("Sin datos", "No hay simulaciones guardadas en el historial.", "info");
        return;
    }

    const rows = historial.map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>$${item.monto.toLocaleString()}</td>
            <td>${item.plazo} meses</td>
            <td>${item.tasa}%</td>
            <td>$${item.totalPagado.toLocaleString()}</td>
            <td>${item.fechaSimulacion}</td>
        </tr>
    `).join('');

    Swal.fire({
        title: '📂 Historial de Simulaciones',
        html: `
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>#</th>
                            <th>Monto</th>
                            <th>Plazo</th>
                            <th>Tasa</th>
                            <th>Total Pagado</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `,
        width: '80%',
        confirmButtonText: 'Cerrar'
    });
}


function vaciarHistorial() {
    Swal.fire({
        title: '¿Vaciar historial?',
        text: 'Se eliminarán todas las simulaciones guardadas.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('historialPrestamos');
            Toastify({
                text: "Historial eliminado",
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#dc3545"
            }).showToast();
        }
    });
}
