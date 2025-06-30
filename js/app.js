function initSimulador() {
    cargarHistorial();
    setupEventListeners();
    updateTasaValue();
}

function setupEventListeners() {
    const $form = document.getElementById('prestamo-form');
    const $limpiarBtn = document.getElementById('limpiar-btn');
    const $compararBtn = document.getElementById('comparar-btn');
    const $tasaSlider = document.getElementById('tasa');

    if ($form) $form.addEventListener('submit', handleSubmit);
    if ($limpiarBtn) $limpiarBtn.addEventListener('click', limpiarDatos);
    if ($compararBtn) $compararBtn.addEventListener('click', compararEscenarios);
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
    const amortizacion = [];


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
        mostrarErrores(['Necesitas al menos 2 préstamos simulados para comparar.']);
        return;
    }

    const $comparacionContainer = document.getElementById('comparacion-container');

    $comparacionContainer.innerHTML = `
    <div class="comparacion-card">
      <h3>Comparación de Escenarios</h3>
      <div class="comparacion-grid">
        <div class="comparacion-header"></div>
        <div class="comparacion-header">Préstamo 1</div>
        <div class="comparacion-header">Préstamo 2</div>
        
        ${['totalPagado', 'totalIntereses', 'costoTotalSeguro'].map(item => `
          <div class="comparacion-item">${formatKey(item)}</div>
          <div>$${historial[0][item]?.toLocaleString() || 'N/A'}</div>
          <div>$${historial[1][item]?.toLocaleString() || 'N/A'}</div>
        `).join('')}
      </div>
    </div>
  `;
}


function updateTasaValue() {
    const $tasaSlider = document.getElementById('tasa');
    const $tasaValue = document.getElementById('tasa-value');

    if ($tasaSlider && $tasaValue) {
        $tasaValue.textContent = `${$tasaSlider.value}%`;
    }
}

function limpiarDatos() {
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

function mostrarErrores(errores) {
    const $resultados = document.getElementById('resultados');

    if (!$resultados) return;

    const erroresHTML = errores.map(error => `
    <div class="error">${error}</div>
  `).join('');

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
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2c3e50; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .total-row { font-weight: bold; background-color: #e1f5fe !important; }
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
      <div style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()">Imprimir Tabla</button>
        <button onclick="window.close()">Cerrar</button>
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


document.addEventListener('DOMContentLoaded', initSimulador);