const API_URL = "https://api-costuras-mama.onrender.com";
const NUMERO_WHATSAPP = "5493816327024"; 

// Función para cambiar la imagen principal cuando tocan una miniatura
function cambiarImagen(idImagenPrincipal, nuevaUrl) {
    document.getElementById(idImagenPrincipal).src = nuevaUrl;
}

async function cargarCatalogo() {
    try {
        const res = await fetch(`${API_URL}/productos/`);
        const productos = await res.json();
        
        const grilla = document.getElementById('grilla-productos');
        const mensajeCarga = document.getElementById('mensaje-carga');
        
        grilla.innerHTML = '';
        mensajeCarga.classList.add('hidden');
        grilla.classList.remove('hidden');

        if (productos.length === 0) {
            grilla.innerHTML = `<p class="col-span-full text-center text-gray-500 text-lg mt-10">En este momento estamos reponiendo stock. ¡Volvé pronto!</p>`;
            return;
        }

        productos.reverse().forEach(p => {
            const hayStock = p.stock > 0;
            const precioFormateado = p.precio.toLocaleString('es-AR');
            
            // LÓGICA DE MÚLTIPLES IMÁGENES
            // 1. Separamos el texto por las comas para tener una lista de links
            const urls = p.url_imagen ? p.url_imagen.split(',') : ["https://images.unsplash.com/photo-1584992236310-6edddc08acff?q=80&w=600&auto=format&fit=crop"];
            
            // 2. La primera imagen es la principal
            const imagenPrincipal = urls[0];
            const idUnico = `img-principal-${p.id}`; // Para que el JS sepa qué foto cambiar

            // 3. Armamos las miniaturas si hay más de 1 foto
            let htmlMiniaturas = "";
            if (urls.length > 1) {
                htmlMiniaturas = `<div class="flex gap-2 mt-3 px-6 overflow-x-auto pb-2 scrollbar-hide">`;
                urls.forEach(url => {
                    htmlMiniaturas += `
                        <img src="${url}" 
                             onclick="cambiarImagen('${idUnico}', '${url}')" 
                             class="w-14 h-14 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-[#D2B48C] transition-all shadow-sm flex-shrink-0">
                    `;
                });
                htmlMiniaturas += `</div>`;
            }
            
            const tarjeta = `
                <div class="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-2xl transition duration-300 flex flex-col h-full relative group pb-4">
                    
                    ${!hayStock ? `<div class="absolute top-4 right-4 bg-red-800 text-white text-xs font-bold px-3 py-1 rounded-sm shadow-md z-10 uppercase tracking-wider">Agotado</div>` : ''}

                    <div class="h-64 overflow-hidden relative">
                        <img id="${idUnico}" src="${imagenPrincipal}" alt="${p.nombre}" class="w-full h-full object-cover transition duration-300">
                    </div>

                    ${htmlMiniaturas}

                    <div class="p-6 flex-grow flex flex-col bg-white">
                        <h3 class="text-2xl font-bold text-gray-800 mb-2 font-serif">${p.nombre}</h3>
                        <p class="text-gray-500 text-sm mb-4 flex-grow italic">${p.descripcion}</p>
                        <p class="text-2xl font-black text-gray-900 mb-6">$${precioFormateado}</p>
                        
                        ${hayStock 
                            ? `<button onclick="comprarPorWhatsApp('${p.nombre}', '${precioFormateado}')" class="w-full bg-[#D2B48C] hover:bg-[#c2a278] text-black font-bold py-3 px-4 rounded-sm shadow-sm transition tracking-wider flex justify-center items-center gap-2">
                                <i class="fa-brands fa-whatsapp text-xl"></i> PEDIR AHORA
                               </button>`
                            : `<button disabled class="w-full bg-gray-100 text-gray-400 font-bold py-3 px-4 rounded-sm cursor-not-allowed tracking-wider">
                                SIN STOCK
                               </button>`
                        }
                    </div>
                </div>
            `;
            grilla.innerHTML += tarjeta;
        });

    } catch (error) {
        document.getElementById('mensaje-carga').innerHTML = `<span class="text-red-500">Error al cargar la tienda. Intentá recargar la página.</span>`;
    }
}

function comprarPorWhatsApp(nombreProducto, precioProducto) {
    const mensaje = `¡Hola! Vengo de tu página web y quiero encargar: *${nombreProducto}* ($${precioProducto}). ¿Tienen envío?`;
    const mensajeCodificado = encodeURIComponent(mensaje);
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${mensajeCodificado}`, '_blank');
}

cargarCatalogo();
