-- Datos de ejemplo (opcional) para probar el buscador y el detalle.
-- Ejecutar después de schema.sql. Bórralos cuando cargues propiedades reales.

insert into public.properties
  (title, description, status, operation_type, property_type, price, currency,
   bedrooms, bathrooms, half_bathrooms, parking_spaces, construction_m2, land_m2,
   state, city, neighborhood, latitude, longitude, amenities, featured, cover_image_url)
values
('Residencia contemporánea en Valle Oriente',
 'Casa de autor con dobles alturas, jardín privado y acabados de lujo. A minutos de Plaza Fiesta San Agustín.',
 'active','sale','casa', 18500000,'MXN', 4,4,1,3, 520,450,
 'Nuevo León','San Pedro Garza García','Valle Oriente', 25.6489,-100.3392,
 array['Alberca','Jardín','Seguridad 24/7','Cuarto de servicio','Terraza','Cocina integral'], true,
 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200'),
('Departamento con vista en Torre Obispado',
 'Departamento en piso alto con vista al Cerro de la Silla, amenidades completas y 2 cajones.',
 'active','rent','departamento', 38000,'MXN', 2,2,0,2, 130,null,
 'Nuevo León','Monterrey','Obispado', 25.6747,-100.3473,
 array['Gimnasio','Alberca','Elevador','Roof garden','Acceso controlado','Vista panorámica'], true,
 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200'),
('Casa familiar en Cumbres Elite',
 'Casa de dos plantas en privada con áreas verdes, ideal para familia. Cerca de escuelas y centros comerciales.',
 'active','sale','casa', 5200000,'MXN', 3,2,1,2, 240,160,
 'Nuevo León','Monterrey','Cumbres Elite', 25.7406,-100.4120,
 array['Acceso controlado','Área de juegos','Jardín','Asador'], true,
 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200'),
('Terreno residencial en Carretera Nacional',
 'Terreno plano en fraccionamiento campestre, con todos los servicios y vista a la sierra.',
 'active','sale','terreno', 3900000,'MXN', 0,0,0,0, null,800,
 'Nuevo León','Monterrey','Carretera Nacional', 25.5560,-100.2400,
 array['Acceso controlado','Seguridad 24/7','Casa club'], false,
 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200');

insert into public.property_images (property_id, url, position)
select id, cover_image_url, 0 from public.properties where cover_image_url is not null
on conflict do nothing;
