// ==========================================
// CONFIGURACIÓN PRINCIPAL
// ==========================================
const API_URL = "https://api-costuras-mama.onrender.com";

// TUS CREDENCIALES DE CLOUDINARY
const CLOUD_NAME = "dpf0rexlz";
const UPLOAD_PRESET = "mama_preset";

let productosGlobales = [];
let llaveMaestra = sessionStorage.getItem('llaveCosturas') || "";
let datosParaExportar = []; // Guarda los datos filtrados para el Excel y la vista previa

// ==========================================
// 0. LOGIN Y ARRANQUE
// ==========================================
if (llaveMaestra === "mama2026") {
    document.getElementById('pantalla-login').classList.add('hidden');
    refrescarTodo();
}

function intentarLogin() {
    const clave = document.getElementById('input-clave').value;
    if (clave === "mama2026") {
        llaveMaestra = clave;
        sessionStorage.setItem('llaveCosturas', clave);
        document.getElementById('pantalla-login').classList.add('hidden');
        refrescarTodo();
    } else {
        document.getElementById('error-login').classList.remove('hidden');
    }
}

function opcionesProtegidas(metodo, cuerpo = null) {
    const config = { method: metodo, headers: { 'Content-Type': 'application/json', 'x-token': llaveMaestra } };
    if (cuerpo) config.body = JSON.stringify(cuerpo);
    return config;
}

function mostrarCarga(mostrar, texto = "Guardando...") {
    const pantalla = document.getElementById('pantalla-carga');
    document.getElementById('texto-carga').innerText = texto;
    if(mostrar) pantalla.classList.remove('hidden'); else pantalla.classList.add('hidden');
}

async function subirFotoACloudinary(archivo) {
    const formData = new FormData();
    formData.append("file", archivo);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
        const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await respuesta.json();
        return data.secure_url; 
    } catch (error) { return null; }
}

// ==========================================
// 1. CARGA DE DATOS PRINCIPAL
// ==========================================
async function refrescarTodo() {
    await cargarProductos();
    actualizarFinanzas();
    cargarCuadernoDiario(); 
}

async function cargarProductos() {
    try {
        const res = await fetch(`${API_URL}/productos/`);
        productosGlobales = await res.json();
        const tabla = document.getElementById('tabla-productos');
        tabla.innerHTML = '';
        if (productosGlobales.length === 0) {
            tabla.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">No hay productos.</td></tr>`;
            return;
        }
        productosGlobales.forEach(p => {
            const colorStock = p.stock < 5 ? 'text-red-500 font-bold' : '';
            const primeraImagen = p.url_imagen ? p.url_imagen.split(',')[0] : null;
            const imgHtml = primeraImagen ? `<img src="${primeraImagen}" class="w-12 h-12 object-cover rounded-md shadow-sm">` : `<div class="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs"><i class="fa-solid fa-image"></i></div>`;
            tabla.innerHTML += `<tr class="border-b hover:bg-gray-50 transition"><td class="p-4">${imgHtml}</td><td class="p-4"><b>${p.nombre}</b><br><small class="text-gray-500">${p.descripcion}</small></td><td class="p-4 font-bold text-green-600">$${p.precio.toLocaleString('es-AR')}</td><td class="p-4 text-lg ${colorStock}">${p.stock}</td><td class="p-4 text-center"><button onclick="abrirModalEditar(${p.id})" class="text-orange-400 mx-2 hover:scale-110 transition"><i class="fa-solid fa-pen"></i></button><button onclick="prepararBorrado('producto', ${p.id})" class="text-red-400 mx-2 hover:scale-110 transition"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    } catch (e) {}
}

async function actualizarFinanzas() {
    try {
        const res = await fetch(`${API_URL}/finanzas/`, opcionesProtegidas('GET'));
        if (!res.ok) return; 
        const data = await res.json();
        document.getElementById('total-caja').innerText = `$ ${data.caja_final.toLocaleString('es-AR')}`;
        document.getElementById('total-ingresos').innerText = `$ ${data.ingresos_totales.toLocaleString('es-AR')}`;
        document.getElementById('total-mercaderia').innerText = `$ ${data.gasto_mercaderia.toLocaleString('es-AR')}`;
        document.getElementById('total-local').innerText = `$ ${data.gasto_local.toLocaleString('es-AR')}`;
    } catch (e) {}
}

// ==========================================
// 2. EL CUADERNO DIARIO CON FILTRO
// ==========================================
async function cargarCuadernoDiario() {
    try {
        const [resVentas, resGastos, resExtras] = await Promise.all([
            fetch(`${API_URL}/ventas/`, opcionesProtegidas('GET')),
            fetch(`${API_URL}/gastos/`, opcionesProtegidas('GET')),
            fetch(`${API_URL}/ingresos-extra/`, opcionesProtegidas('GET'))
        ]);

        const ventas = await resVentas.json();
        const gastos = await resGastos.json();
        const extras = await resExtras.json();

        const listaVentas = ventas.map(v => {
            const prod = productosGlobales.find(p => p.id === v.producto_id);
            return { tipoDato: 'venta', id: v.id, fecha: v.fecha, categoria: 'Venta', categoria_pura: 'venta', detalle: `${v.cantidad}x ${prod ? prod.nombre : "Borrado"}`, monto: v.dinero_ingresado, signo: '+' };
        });

        const listaGastos = gastos.map(g => ({ tipoDato: 'gasto', id: g.id, fecha: g.fecha, categoria: `Gasto ${g.categoria}`, categoria_pura: g.categoria, detalle: g.descripcion, monto: g.monto, signo: '-' }));
        
        const listaExtras = extras.map(e => ({ tipoDato: 'extra', id: e.id, fecha: e.fecha, categoria: 'Ingreso Extra', categoria_pura: 'extra', detalle: e.descripcion, monto: e.monto, signo: '+' }));

        let todosLosMovimientos = [...listaVentas, ...listaGastos, ...listaExtras];
        todosLosMovimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id);

        // Lógica del filtro rápido
        const filtro = document.getElementById('filtro-rapido-cuaderno').value;
        if (filtro !== 'todos') {
            todosLosMovimientos = todosLosMovimientos.filter(item => item.categoria_pura === filtro);
        }

        const tabla = document.getElementById('cuaderno-diario');
        tabla.innerHTML = '';

        if (todosLosMovimientos.length === 0) {
            tabla.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">No hay movimientos registrados.</td></tr>`;
            return;
        }

        todosLosMovimientos.forEach(item => {
            const esIngreso = item.signo === '+';
            const colorMonto = esIngreso ? 'text-green-600' : 'text-red-500';
            const simbolo = esIngreso ? '+' : '-';
            
            let icono = "🟢";
            if (item.tipoDato === 'extra') icono = "🔵";
            if (item.tipoDato === 'gasto' && item.categoria_pura === 'Mercadería') icono = "📦";
            if (item.tipoDato === 'gasto' && item.categoria_pura === 'Local') icono = "🏢";

            // Botón de editar (solo para gastos y extras)
            let btnEditar = "";
            if (item.tipoDato === 'gasto') {
                btnEditar = `<button onclick="abrirModalEditarGasto(${item.id}, '${item.categoria_pura}', '${item.detalle.replace(/'/g, "\\'")}', ${item.monto})" class="text-gray-300 hover:text-orange-400 transition mx-1" title="Editar"><i class="fa-solid fa-pen"></i></button>`;
            } else if (item.tipoDato === 'extra') {
                btnEditar = `<button onclick="abrirModalEditarExtra(${item.id}, '${item.detalle.replace(/'/g, "\\'")}', ${item.monto})" class="text-gray-300 hover:text-orange-400 transition mx-1" title="Editar"><i class="fa-solid fa-pen"></i></button>`;
            }

            tabla.innerHTML += `
                <tr class="border-b hover:bg-gray-50 transition">
                    <td class="p-4 text-sm text-gray-500 whitespace-nowrap">${item.fecha}</td>
                    <td class="p-4 hidden md:table-cell font-bold text-gray-600 text-xs uppercase">${icono} ${item.categoria}</td>
                    <td class="p-4 text-gray-800">${item.detalle}</td>
                    <td class="p-4 text-right font-black ${colorMonto} whitespace-nowrap">${simbolo} $${item.monto.toLocaleString('es-AR')}</td>
                    <td class="p-4 text-center whitespace-nowrap">
                        ${btnEditar}
                        <button onclick="prepararBorrado('${item.tipoDato}', ${item.id})" class="text-gray-300 hover:text-red-500 transition mx-1" title="Anular Movimiento">
                            <i class="fa-solid fa-trash-can text-lg"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error("Error cuaderno:", e); }
}

// ==========================================
// 3. SISTEMA DE BORRADO
// ==========================================
let tipoABorrar = "", idABorrar = null;
function prepararBorrado(tipo, id) { tipoABorrar = tipo; idABorrar = id; document.getElementById('modal-borrar').classList.remove('hidden'); document.getElementById('btn-confirmar-borrar').onclick = ejecutarBorrado; }
function cerrarModalBorrar() { document.getElementById('modal-borrar').classList.add('hidden'); }

async function ejecutarBorrado() {
    let url = "";
    if (tipoABorrar === 'producto') url = `${API_URL}/productos/${idABorrar}`;
    if (tipoABorrar === 'venta') url = `${API_URL}/ventas/${idABorrar}`;
    if (tipoABorrar === 'extra') url = `${API_URL}/ingresos-extra/${idABorrar}`;
    if (tipoABorrar === 'gasto') url = `${API_URL}/gastos/${idABorrar}`;
    await fetch(url, opcionesProtegidas('DELETE'));
    cerrarModalBorrar(); refrescarTodo();
}

// ==========================================
// 4. CREAR VENTAS, GASTOS Y EXTRAS
// ==========================================
function abrirModalVenta() {
    const select = document.getElementById('venta-producto-id'); select.innerHTML = '';
    let hayStock = false;
    productosGlobales.forEach(p => { if(p.stock > 0) { select.innerHTML += `<option value="${p.id}">${p.nombre} (Disp: ${p.stock})</option>`; hayStock = true; }});
    if(!hayStock) { alert("No hay productos con stock."); return; }
    document.getElementById('modal-venta').classList.remove('hidden');
}
function cerrarModalVenta() { document.getElementById('modal-venta').classList.add('hidden'); document.getElementById('venta-cantidad').value = 1; }
async function guardarVenta(e) { e.preventDefault(); const datos = { producto_id: parseInt(document.getElementById('venta-producto-id').value), cantidad: parseInt(document.getElementById('venta-cantidad').value) }; await fetch(`${API_URL}/ventas/`, opcionesProtegidas('POST', datos)); cerrarModalVenta(); refrescarTodo(); }

function abrirModalIngresoExtra() { document.getElementById('modal-ingreso-extra').classList.remove('hidden'); }
function cerrarModalIngresoExtra() { document.getElementById('modal-ingreso-extra').classList.add('hidden'); document.getElementById('extra-descripcion').value=''; document.getElementById('extra-monto').value=''; }
async function guardarIngresoExtra(e) { e.preventDefault(); const datos = { descripcion: document.getElementById('extra-descripcion').value, monto: parseFloat(document.getElementById('extra-monto').value) }; await fetch(`${API_URL}/ingresos-extra/`, opcionesProtegidas('POST', datos)); cerrarModalIngresoExtra(); refrescarTodo(); }

function abrirModalGasto() { document.getElementById('modal-gasto').classList.remove('hidden'); }
function cerrarModalGasto() { document.getElementById('modal-gasto').classList.add('hidden'); document.getElementById('gasto-descripcion').value=''; document.getElementById('gasto-monto').value=''; }
async function guardarGasto(e) { 
    e.preventDefault(); 
    const datos = { descripcion: document.getElementById('gasto-descripcion').value, monto: parseFloat(document.getElementById('gasto-monto').value), categoria: document.getElementById('gasto-categoria').value }; 
    await fetch(`${API_URL}/gastos/`, opcionesProtegidas('POST', datos)); 
    cerrarModalGasto(); refrescarTodo(); 
}

// ==========================================
// 5. EDITAR GASTOS Y EXTRAS
// ==========================================
function abrirModalEditarGasto(id, categoria, detalle, monto) {
    document.getElementById('edit-gasto-id').value = id;
    document.getElementById('edit-gasto-categoria').value = categoria;
    document.getElementById('edit-gasto-descripcion').value = detalle;
    document.getElementById('edit-gasto-monto').value = monto;
    document.getElementById('modal-editar-gasto').classList.remove('hidden');
}
function cerrarModalEditarGasto() { document.getElementById('modal-editar-gasto').classList.add('hidden'); }

async function guardarEdicionGasto(e) {
    e.preventDefault();
    const id = document.getElementById('edit-gasto-id').value;
    const datos = { 
        descripcion: document.getElementById('edit-gasto-descripcion').value, 
        monto: parseFloat(document.getElementById('edit-gasto-monto').value),
        categoria: document.getElementById('edit-gasto-categoria').value 
    };
    await fetch(`${API_URL}/gastos/${id}`, opcionesProtegidas('PUT', datos));
    cerrarModalEditarGasto(); refrescarTodo();
}

function abrirModalEditarExtra(id, detalle, monto) {
    document.getElementById('edit-extra-id').value = id;
    document.getElementById('edit-extra-descripcion').value = detalle;
    document.getElementById('edit-extra-monto').value = monto;
    document.getElementById('modal-editar-extra').classList.remove('hidden');
}
function cerrarModalEditarExtra() { document.getElementById('modal-editar-extra').classList.add('hidden'); }

async function guardarEdicionExtra(e) {
    e.preventDefault();
    const id = document.getElementById('edit-extra-id').value;
    const datos = { 
        descripcion: document.getElementById('edit-extra-descripcion').value, 
        monto: parseFloat(document.getElementById('edit-extra-monto').value) 
    };
    await fetch(`${API_URL}/ingresos-extra/${id}`, opcionesProtegidas('PUT', datos));
    cerrarModalEditarExtra(); refrescarTodo();
}

// ==========================================
// 6. PRODUCTOS CON MÚLTIPLES FOTOS
// ==========================================
function abrirModal() { document.getElementById('modal-producto').classList.remove('hidden'); }
function cerrarModal() { document.getElementById('modal-producto').classList.add('hidden'); document.getElementById('nombre').value=''; document.getElementById('descripcion').value=''; document.getElementById('precio').value=''; document.getElementById('stock').value=''; document.getElementById('imagen-producto').value=''; }
async function guardarProducto(e) {
    e.preventDefault();
    const inputFoto = document.getElementById('imagen-producto');
    let url_final = null;
    if (inputFoto.files.length > 0) {
        mostrarCarga(true, "Subiendo fotos...");
        let urls_subidas = [];
        for (let i = 0; i < inputFoto.files.length; i++) {
            let url = await subirFotoACloudinary(inputFoto.files[i]);
            if (url) urls_subidas.push(url);
        }
        url_final = urls_subidas.join(','); 
    } else { mostrarCarga(true, "Guardando producto..."); }
    const p = { nombre: document.getElementById('nombre').value, descripcion: document.getElementById('descripcion').value, precio: parseFloat(document.getElementById('precio').value), stock: parseInt(document.getElementById('stock').value), url_imagen: url_final };
    await fetch(`${API_URL}/productos/`, opcionesProtegidas('POST', p));
    mostrarCarga(false); cerrarModal(); refrescarTodo();
}

function abrirModalEditar(id) {
    const p = productosGlobales.find(x => x.id === id);
    document.getElementById('edit-id').value = p.id; document.getElementById('edit-nombre').value = p.nombre; document.getElementById('edit-descripcion').value = p.descripcion; document.getElementById('edit-precio').value = p.precio; document.getElementById('edit-stock').value = p.stock; document.getElementById('edit-url-vieja').value = p.url_imagen || ""; 
    document.getElementById('modal-editar').classList.remove('hidden');
}
function cerrarModalEditar() { document.getElementById('modal-editar').classList.add('hidden'); document.getElementById('edit-imagen-producto').value = ''; }
async function guardarEdicion(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const inputFoto = document.getElementById('edit-imagen-producto');
    let url_final = document.getElementById('edit-url-vieja').value; 
    if (inputFoto.files.length > 0) {
        mostrarCarga(true, "Actualizando fotos...");
        let urls_subidas = [];
        for (let i = 0; i < inputFoto.files.length; i++) {
            let url = await subirFotoACloudinary(inputFoto.files[i]);
            if (url) urls_subidas.push(url);
        }
        url_final = urls_subidas.join(',');
    } else { mostrarCarga(true, "Actualizando producto..."); }
    const p = { nombre: document.getElementById('edit-nombre').value, descripcion: document.getElementById('edit-descripcion').value, precio: parseFloat(document.getElementById('edit-precio').value), stock: parseInt(document.getElementById('edit-stock').value), url_imagen: url_final };
    await fetch(`${API_URL}/productos/${id}`, opcionesProtegidas('PUT', p));
    mostrarCarga(false); cerrarModalEditar(); refrescarTodo();
}

// ==========================================
// 7. VISTA PREVIA Y EXPORTACIÓN A EXCEL
// ==========================================
function abrirModalBalance() { 
    document.getElementById('modal-balance').classList.remove('hidden'); 
    document.getElementById('contenedor-preview').classList.add('hidden');
    document.getElementById('total-preview').classList.add('hidden');
    document.getElementById('btn-descargar-excel').classList.add('hidden');
}
function cerrarModalBalance() { document.getElementById('modal-balance').classList.add('hidden'); }

async function generarVistaPrevia() {
    const [resVentas, resGastos, resExtras] = await Promise.all([ 
        fetch(`${API_URL}/ventas/`, opcionesProtegidas('GET')), 
        fetch(`${API_URL}/gastos/`, opcionesProtegidas('GET')), 
        fetch(`${API_URL}/ingresos-extra/`, opcionesProtegidas('GET')) 
    ]);
    const ventas = await resVentas.json(); 
    const gastos = await resGastos.json(); 
    const extras = await resExtras.json();

    let dataUnificada = [];
    ventas.forEach(v => { const prod = productosGlobales.find(p => p.id === v.producto_id); dataUnificada.push({ fecha: v.fecha, categoria: 'Venta', detalle: `${v.cantidad}x ${prod ? prod.nombre : "Borrado"}`, monto: v.dinero_ingresado, signo: '+' }); });
    gastos.forEach(g => dataUnificada.push({ fecha: g.fecha, categoria: `Gasto ${g.categoria}`, detalle: g.descripcion, monto: g.monto, signo: '-' }));
    extras.forEach(e => dataUnificada.push({ fecha: e.fecha, categoria: 'Ingreso Extra', detalle: e.descripcion, monto: e.monto, signo: '+' }));

    const fechaInicio = document.getElementById('filtro-inicio').value;
    const fechaFin = document.getElementById('filtro-fin').value;
    const tipo = document.getElementById('filtro-tipo').value;

    datosParaExportar = dataUnificada.filter(m => {
        let cumpleFecha = true;
        if (fechaInicio) cumpleFecha = cumpleFecha && m.fecha >= fechaInicio;
        if (fechaFin) cumpleFecha = cumpleFecha && m.fecha <= fechaFin;
        let cumpleTipo = true;
        if (tipo === 'ingresos') cumpleTipo = (m.signo === '+');
        if (tipo === 'egresos') cumpleTipo = (m.signo === '-');
        return cumpleFecha && cumpleTipo;
    });

    const tabla = document.getElementById('tabla-preview-balance');
    tabla.innerHTML = '';
    let totalCalculo = 0;

    if(datosParaExportar.length === 0) {
        alert("No hay movimientos para las fechas y filtros seleccionados.");
        return;
    }

    datosParaExportar.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(row => {
        if(row.signo === '+') totalCalculo += row.monto; else totalCalculo -= row.monto;
        const color = row.signo === '+' ? 'text-green-600' : 'text-red-500';
        tabla.innerHTML += `<tr><td class="py-2 text-gray-500 whitespace-nowrap">${row.fecha}</td><td class="py-2"><span class="font-bold text-[10px] text-gray-400 uppercase block">${row.categoria}</span>${row.detalle}</td><td class="py-2 text-right font-bold ${color} whitespace-nowrap">${row.signo}$${row.monto.toLocaleString('es-AR')}</td></tr>`;
    });

    document.getElementById('contenedor-preview').classList.remove('hidden');
    
    const divTotal = document.getElementById('total-preview');
    divTotal.classList.remove('hidden');
    divTotal.className = `text-right font-black text-xl mb-4 ${totalCalculo >= 0 ? 'text-indigo-600' : 'text-red-600'}`;
    divTotal.innerText = `Balance: $${totalCalculo.toLocaleString('es-AR')}`;

    document.getElementById('btn-descargar-excel').classList.remove('hidden');
}

function descargarCSV() {
    let csvContent = "\uFEFF"; 
    csvContent += "Fecha;Tipo de Movimiento;Detalle;Monto\n"; 
    datosParaExportar.forEach(row => {
        let montoF = (row.signo === '+' ? row.monto : -row.monto).toString().replace('.', ','); 
        csvContent += `${row.fecha};${row.categoria};"${row.detalle}";${montoF}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Balance_Matilde_V_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
