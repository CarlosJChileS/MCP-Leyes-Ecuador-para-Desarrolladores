import fs from 'node:fs';
const path = new URL('../data/normativa.json', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
const additions = {
  'comercio-electronico': ['mensajes-datos', 'Arts. 2, 44 y 48', 'Conservar integridad, accesibilidad y trazabilidad de mensajes de datos y contratación electrónica cuando el servicio opere digitalmente.', 'Contratación o prestación de servicios electrónicos.', 'Términos, aceptación, registros de transacción y controles de integridad.'],
  'propiedad-intelectual': ['licencias-software', 'Derechos de autor y software', 'Contar con licencias o derechos suficientes para el software, contenido, imágenes y dependencias utilizados.', 'Uso o distribución de obras, software o contenidos de terceros.', 'Inventario de licencias, avisos de autoría y contratos de uso.'],
  'telecomunicaciones': ['servicios-conectividad', 'Obligaciones sectoriales aplicables', 'Verificar si el servicio presta o intermedia servicios de telecomunicaciones sujetos a autorización o regulación sectorial.', 'El proyecto ofrece servicios de telecomunicaciones o explota redes/servicios regulados.', 'Análisis de alcance y autorización sectorial, si corresponde.'],
  'coip-delitos-informaticos': ['prevencion-acceso-ilicito', 'Delitos informáticos aplicables', 'Implementar controles para prevenir acceso no autorizado, alteración, extracción o destrucción de información.', 'El sistema almacena, procesa o expone información digital.', 'Control de acceso, registros, pruebas de seguridad y respuesta a incidentes.'],
  'codigo-trabajo': ['relaciones-laborales', 'Obligaciones laborales aplicables', 'Revisar contratos, jornada, remuneración y tratamiento de datos de trabajadores cuando el proyecto tenga personal.', 'Existencia de empleados o relaciones laborales.', 'Contratos, roles, políticas y registros laborales.'],
  'ley-companias': ['gobierno-societario', 'Obligaciones societarias aplicables', 'Verificar constitución, representación, administración y obligaciones de la compañía cuando el proyecto opere mediante una sociedad.', 'El titular del servicio es una compañía o sociedad.', 'RUC, escritura, nombramientos y registros societarios.'],
  'fintech': ['servicio-financiero-tecnologico', 'Ámbito regulado fintech', 'Determinar si el producto realiza actividades financieras tecnológicas reservadas o reguladas antes de operar.', 'El proyecto ofrece servicios financieros tecnológicos a terceros.', 'Análisis regulatorio y autorización del organismo competente, si aplica.'],
  'marco-sector-financiero': ['servicio-financiero-regulado', 'Regulación financiera sectorial', 'Revisar controles y autorización sectorial cuando el sistema opere para una entidad financiera o preste un servicio regulado.', 'El proyecto pertenece al sector financiero o presta servicios a entidades reguladas.', 'Clasificación del servicio, contratos y controles sectoriales.'],
  'marco-sector-salud': ['datos-salud', 'Datos y servicios de salud', 'Aplicar revisión sectorial reforzada cuando el sistema trate información de salud o preste servicios sanitarios.', 'Tratamiento de datos de salud o prestación de servicios sanitarios.', 'Evaluación de impacto, controles de acceso y autorización sectorial.'],
  'marco-sector-educativo': ['datos-estudiantes', 'Datos y servicios educativos', 'Revisar obligaciones sectoriales y protección reforzada cuando el sistema trate datos de estudiantes o preste servicios educativos.', 'Plataformas educativas, instituciones o datos de estudiantes.', 'Autorización institucional, aviso, controles y protocolos para menores.']
};
for (const source of catalog) {
  const item = additions[source.id];
  if (!item || source.obligations?.length) continue;
  source.obligations = [{ id: item[0], article: item[1], sourceUrl: source.documentUrl ?? source.url, requirement: { es: item[2], en: item[2] }, appliesWhen: { es: item[3], en: item[3] }, evidence: [{ es: item[4], en: item[4] }], documentaryReviewedAt: '2026-09-09' }];
}
fs.writeFileSync(path, JSON.stringify(catalog, null, 2) + '\n');
