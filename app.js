const API_URL = "https://api-costuras-mama.onrender.com";
const CLOUD_NAME = "dpf0rexlz";
const UPLOAD_PRESET = "mama_preset";

let productosGlobales = [];
let llaveMaestra = sessionStorage.getItem('llaveCosturas') || "";

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

function mostrarCarga(mostrar, texto = "Guardando...") {
    const pantalla = document.getElementById('pantalla-carga');
    document.getElementById('texto-carga').innerText = texto;
    if(mostrar) pantalla.classList.remove('hidden'); else pantalla.classList.add('hidden');
}

async function refrescarTodo() {
    await cargarProductos(); // Productos primero para tener los nombres
    actualizarFinanzas();
    cargarCuadernoDiario(); // ¡La nueva función que unifica todo!
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
            tabla.innerHTML += `<tr class="border-b hover:bg-gray-50"><td class="p-4">${imgHtml}</td><td class="p-4"><b>${p.nombre}</b><br><small class="text-gray-500">${p.descripcion}</small></td><td class="p-4 font-bold text-green-600">$${p.precio.toLocaleString('es-AR')}</td><td class="p-4 text-lg ${colorStock}">${p.stock}</td><td class="p-4 text-center"><button onclick="abrirModalEditar(${p.id})" class="text-orange-400 mx-2"><i class="fa-solid fa-pen"></i></button><button onclick="prepararBorrado('producto', ${p.id})" class="text-red-400 mx-2"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    } catch (e) {}
}

async function actualizarFinanzas() {
    try {
        const res = await fetch(`${API_URL}/finanzas/`, opcionesProtegidas('GET'));
        if (!res.ok) return; 
        const data = await res.json();
        
        // DIBUJAMOS LOS NUEVOS VALORES DEL CUADERNO
        document.getElementById('total-caja').innerText = `$ ${data.caja_final.toLocaleString('es-AR')}`;
        document.getElementById('total-ingresos').innerText = `$ ${data.ingresos_totales.toLocaleString('es-AR')}`;
        document.getElementById('total-mercaderia').innerText = `$ ${data.gasto_mercaderia.toLocaleString('es-AR')}`;
        document.getElementById('total-local').innerText = `$ ${data.gasto_local.toLocaleString('es-AR')}`;
    } catch (e) {}
}

// ==========================================
// EL NUEVO "CUADERNO DIARIO" UNIFICADO
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

        // 1. Homogeneizamos los datos
        const listaVentas = ventas.map(v => {
            const prod = productosGlobales.find(p => p.id === v.producto_id);
            return { tipoDato: 'venta', id: v.id, fecha: v.fecha, categoria: 'Venta', detalle: `${v.cantidad}x ${prod ? prod.nombre : "Borrado"}`, monto: v.dinero_ingresado, signo: '+' };
        });

        const listaGastos = gastos.map(g => ({ tipoDato: 'gasto', id: g.id, fecha: g.fecha, categoria: `Gasto ${g.categoria}`, detalle: g.descripcion, monto: g.monto, signo: '-' }));
        
        const listaExtras = extras.map(e => ({ tipoDato: 'extra', id: e.id, fecha: e.fecha, categoria: 'Ingreso Extra', detalle: e.descripcion, monto: e.monto, signo: '+' }));

        // 2. Juntamos todo en un solo array
        let todosLosMovimientos = [...listaVentas, ...listaGastos, ...listaExtras];

        // 3. Ordenamos por fecha (los más nuevos arriba)
        todosLosMovimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id);

        const tabla = document.getElementById('cuaderno-diario');
        tabla.innerHTML = '';

        if (todosLosMovimientos.length === 0) {
            tabla.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">No hay movimientos registrados.</td></tr>`;
            return;
        }

        todosLosMovimientos.forEach(item => {
            // Estilos dependiendo de si entra o sale plata
            const esIngreso = item.signo === '+';
            const colorMonto = esIngreso ? 'text-green-600' : 'text-red-500';
            const simbolo = esIngreso ? '+' : '-';
            
            // Iconitos para que sea más visual
            let icono = "";
            if (item.tipoDato === 'venta') icono = "🟢";
            if (item.tipoDato === 'extra') icono = "🔵";
            if (item.tipoDato === 'gasto' && item.categoria.includes("Mercadería")) icono = "📦";
            if (item.tipoDato === 'gasto' && item.categoria.includes("Local")) icono = "🏢";

            tabla.innerHTML += `
                <tr class="border-b hover:bg-gray-50 transition">
                    <td class="p-4 text-sm text-gray-500 whitespace-nowrap">${item.fecha}</td>
                    <td class="p-4 hidden md:table-cell font-bold text-gray-600 text-xs uppercase">${icono} ${item.categoria}</td>
                    <td class="p-4 text-gray-800">${item.detalle}</td>
                    <td class="p-4 text-right font-black ${colorMonto} whitespace-nowrap">${simbolo} $${item.monto.toLocaleString('es-AR')}</td>
                    <td class="p-4 text-center">
                        <button onclick="prepararBorrado('${item.tipoDato}', ${item.id})" class="text-gray-300 hover:text-red-500 transition" title="Anular Movimiento">
                            <i class="fa-solid fa-trash-can text-lg"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error("Error cuaderno:", e); }
}

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

// ¡GASTO ACTUALIZADO PARA MANDAR CATEGORÍA!
function abrirModalGasto() { document.getElementById('modal-gasto').classList.remove('hidden'); }
function cerrarModalGasto() { document.getElementById('modal-gasto').classList.add('hidden'); document.getElementById('gasto-descripcion').value=''; document.getElementById('gasto-monto').value=''; }
async function guardarGasto(e) { 
    e.preventDefault(); 
    const datos = { 
        descripcion: document.getElementById('gasto-descripcion').value, 
        monto: parseFloat(document.getElementById('gasto-monto').value),
        categoria: document.getElementById('gasto-categoria').value // Local o Mercadería
    }; 
    await fetch(`${API_URL}/gastos/`, opcionesProtegidas('POST', datos)); 
    cerrarModalGasto(); 
    refrescarTodo(); 
}

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
    } else { mostrarCarga(true); }
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
    } else { mostrarCarga(true); }
    const p = { nombre: document.getElementById('edit-nombre').value, descripcion: document.getElementById('edit-descripcion').value, precio: parseFloat(document.getElementById('edit-precio').value), stock: parseInt(document.getElementById('edit-stock').value), url_imagen: url_final };
    await fetch(`${API_URL}/productos/${id}`, opcionesProtegidas('PUT', p));
    mostrarCarga(false); cerrarModalEditar(); refrescarTodo();
}