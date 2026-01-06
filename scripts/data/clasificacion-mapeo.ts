/**
 * Mapeo de Clasificación para Migración de Productos
 *
 * Este archivo contiene la configuración corregida para:
 * - Categorías (16 categorías principales limpias)
 * - Tipos de Producto (extraídos de SUBGRUPO)
 * - Mapeo de productos con sus clasificaciones
 *
 * NOTA: Todos los textos usan formato Title Case (Mayúscula-Minúscula)
 */

// ============================================================================
// CATEGORÍAS - 16 categorías principales corregidas
// ============================================================================

export interface CategoriaConfig {
  codigo: string;
  nombre: string;
  descripcion: string;
  color: string;
  icono: string;
  orden: number;
}

export const CATEGORIAS: CategoriaConfig[] = [
  {
    codigo: 'CAT-001',
    nombre: 'Sistema Inmune',
    descripcion: 'Productos para fortalecer el sistema inmunológico',
    color: '#10B981',
    icono: 'Shield',
    orden: 1
  },
  {
    codigo: 'CAT-002',
    nombre: 'Salud Digestiva',
    descripcion: 'Probióticos, enzimas y productos para la digestión',
    color: '#F59E0B',
    icono: 'Salad',
    orden: 2
  },
  {
    codigo: 'CAT-003',
    nombre: 'Salud Cardiovascular',
    descripcion: 'Omega 3, CoQ10 y productos para el corazón',
    color: '#EF4444',
    icono: 'Heart',
    orden: 3
  },
  {
    codigo: 'CAT-004',
    nombre: 'Salud Cerebral',
    descripcion: 'Productos para la función cognitiva y cerebral',
    color: '#8B5CF6',
    icono: 'Brain',
    orden: 4
  },
  {
    codigo: 'CAT-005',
    nombre: 'Sueño y Relajación',
    descripcion: 'Melatonina, magnesio y productos para el descanso',
    color: '#6366F1',
    icono: 'Moon',
    orden: 5
  },
  {
    codigo: 'CAT-006',
    nombre: 'Energía y Vitalidad',
    descripcion: 'Vitaminas B, adaptógenos para energía',
    color: '#EC4899',
    icono: 'Zap',
    orden: 6
  },
  {
    codigo: 'CAT-007',
    nombre: 'Manejo del Estrés',
    descripcion: 'Ashwagandha y productos para el estrés',
    color: '#14B8A6',
    icono: 'Leaf',
    orden: 7
  },
  {
    codigo: 'CAT-008',
    nombre: 'Salud Ósea',
    descripcion: 'Calcio, vitamina D, colágeno para huesos',
    color: '#78716C',
    icono: 'Bone',
    orden: 8
  },
  {
    codigo: 'CAT-009',
    nombre: 'Salud Hormonal',
    descripcion: 'Productos para balance hormonal',
    color: '#F472B6',
    icono: 'Activity',
    orden: 9
  },
  {
    codigo: 'CAT-010',
    nombre: 'Antioxidantes y Metabolismo',
    descripcion: 'NAD+, resveratrol, productos antienvejecimiento',
    color: '#A855F7',
    icono: 'Sparkles',
    orden: 10
  },
  {
    codigo: 'CAT-011',
    nombre: 'Multivitamínicos',
    descripcion: 'Multivitamínicos para todas las edades',
    color: '#3B82F6',
    icono: 'Pill',
    orden: 11
  },
  {
    codigo: 'CAT-012',
    nombre: 'Salud Visual',
    descripcion: 'Luteína y productos para la vista',
    color: '#06B6D4',
    icono: 'Eye',
    orden: 12
  },
  {
    codigo: 'CAT-013',
    nombre: 'Salud Hepática',
    descripcion: 'Cardo mariano y productos para el hígado',
    color: '#84CC16',
    icono: 'Droplet',
    orden: 13
  },
  {
    codigo: 'CAT-014',
    nombre: 'Salud Celular',
    descripcion: 'Folato y productos para la salud celular',
    color: '#0EA5E9',
    icono: 'Circle',
    orden: 14
  },
  {
    codigo: 'CAT-015',
    nombre: 'Uso Tópico',
    descripcion: 'Productos de aplicación externa',
    color: '#64748B',
    icono: 'Hand',
    orden: 15
  },
  {
    codigo: 'CAT-016',
    nombre: 'Piel y Articulaciones',
    descripcion: 'Colágeno y productos para piel y articulaciones',
    color: '#FB923C',
    icono: 'Layers',
    orden: 16
  }
];

// ============================================================================
// TIPOS DE PRODUCTO - Extraídos de SUBGRUPO y normalizados
// ============================================================================

export interface TipoProductoConfig {
  codigo: string;
  nombre: string;
  alias?: string[];
  principioActivo?: string;
}

export const TIPOS_PRODUCTO: TipoProductoConfig[] = [
  { codigo: 'TP-001', nombre: '5-HTP', principioActivo: '5-Hidroxitriptófano' },
  { codigo: 'TP-002', nombre: 'Probióticos + Prebióticos', alias: ['Probioticos', 'Prebioticos'] },
  { codigo: 'TP-003', nombre: 'D3 + Omega 3', alias: ['Aceite de Hígado de Bacalao'] },
  { codigo: 'TP-004', nombre: 'Aceite de Orégano', principioActivo: 'Carvacrol' },
  { codigo: 'TP-005', nombre: 'Multivitamínico para Adultos', alias: ['Adult Gummies'] },
  { codigo: 'TP-006', nombre: 'Allisure Powder', principioActivo: 'Alicina estabilizada' },
  { codigo: 'TP-007', nombre: 'Ácido Alfa Lipoico', alias: ['Alpha Lipoic Acid', 'ALA'] },
  { codigo: 'TP-008', nombre: 'Krill Oil', alias: ['Aceite de Krill'], principioActivo: 'Omega 3 + Astaxantina' },
  { codigo: 'TP-009', nombre: 'Ashwagandha', principioActivo: 'Withanólidos' },
  { codigo: 'TP-010', nombre: 'Astaxantina', principioActivo: 'Astaxantina' },
  { codigo: 'TP-011', nombre: 'Vitamina B12', alias: ['Cianocobalamina', 'Metilcobalamina'] },
  { codigo: 'TP-012', nombre: 'Berberina', principioActivo: 'Berberina HCL' },
  { codigo: 'TP-013', nombre: 'Boro', principioActivo: 'Boro quelado' },
  { codigo: 'TP-014', nombre: 'D3 + Calcio + Zinc' },
  { codigo: 'TP-015', nombre: 'Multivitamínico para Mujer', alias: ['Womens Multivitamin'] },
  { codigo: 'TP-016', nombre: 'Multivitamínico para Niño', alias: ['Kids Multivitamin', 'Children Gummies'] },
  { codigo: 'TP-017', nombre: 'Citicolina CDP', principioActivo: 'CDP-Colina' },
  { codigo: 'TP-018', nombre: 'Citrato de Magnesio' },
  { codigo: 'TP-019', nombre: 'Colágeno', alias: ['Péptidos de Colágeno', 'Multi Collagen'] },
  { codigo: 'TP-020', nombre: 'Complejo B', alias: ['Vitamina B Complex'] },
  { codigo: 'TP-021', nombre: 'Omega 3 + GLA', alias: ['Complete Omega'] },
  { codigo: 'TP-022', nombre: 'CoQ10', alias: ['Ubiquinol', 'Coenzima Q10'] },
  { codigo: 'TP-023', nombre: 'D3', alias: ['Vitamina D3', 'Colecalciferol'] },
  { codigo: 'TP-024', nombre: 'D3 + K2', principioActivo: 'Colecalciferol + Menaquinona' },
  { codigo: 'TP-025', nombre: 'D + B12', alias: ['Detoxzee'] },
  { codigo: 'TP-026', nombre: 'Extracto Húmico Molecular', alias: ['Digestive Drops'] },
  { codigo: 'TP-027', nombre: 'Enzimas Digestivas', alias: ['Super Enzimas'] },
  { codigo: 'TP-028', nombre: '5-MTHF', alias: ['Folato', 'Metilfolato'], principioActivo: 'Metiltetrahidrofolato' },
  { codigo: 'TP-029', nombre: 'Ginkgo Biloba', principioActivo: 'Ginkgo Biloba Extract' },
  { codigo: 'TP-030', nombre: 'Glucosamina Condroitina', principioActivo: 'Glucosamina + Condroitina' },
  { codigo: 'TP-031', nombre: 'Omega 3', alias: ['DHA', 'EPA', 'Fish Oil'] },
  { codigo: 'TP-032', nombre: 'Multivitamínico para Hombre', alias: ['Mens Multivitamin'] },
  { codigo: 'TP-033', nombre: 'KSM-66 + Ashwagandha', principioActivo: 'KSM-66' },
  { codigo: 'TP-034', nombre: 'L-Teanina', principioActivo: 'L-Teanina' },
  { codigo: 'TP-035', nombre: 'Magnesio L-Treonato', alias: ['Magtein', 'Neuromag'] },
  { codigo: 'TP-036', nombre: 'Extracto Herbal', alias: ['Lingo Leap'] },
  { codigo: 'TP-037', nombre: 'Melena de León', alias: ['Lions Mane'], principioActivo: 'Hericium erinaceus' },
  { codigo: 'TP-038', nombre: 'Vitamina C', alias: ['Vitamina C Liposomal'] },
  { codigo: 'TP-039', nombre: 'Luteína', principioActivo: 'Luteína + Zeaxantina' },
  { codigo: 'TP-040', nombre: 'Glicinato de Magnesio', alias: ['Magnesium Glycinate'] },
  { codigo: 'TP-041', nombre: 'Magnesio + Ashwagandha' },
  { codigo: 'TP-042', nombre: 'Bisglicinato de Magnesio', alias: ['Magnesium Bisglycinate'] },
  { codigo: 'TP-043', nombre: 'Melatonina' },
  { codigo: 'TP-044', nombre: 'Melatonina + L-Teanina' },
  { codigo: 'TP-045', nombre: 'Cardo Mariano', alias: ['Milk Thistle'], principioActivo: 'Silimarina' },
  { codigo: 'TP-046', nombre: 'Multivitamínico', alias: ['Multivitamínico Líquido'] },
  { codigo: 'TP-047', nombre: 'Myo Inositol', principioActivo: 'Mio-Inositol' },
  { codigo: 'TP-048', nombre: 'NAD+', alias: ['NAD'], principioActivo: 'Nicotinamida Ribósido' },
  { codigo: 'TP-049', nombre: 'Resveratrol + NAD', alias: ['NAD+ Resveratrol'] },
  { codigo: 'TP-050', nombre: 'Omega 3 + Astaxantina', alias: ['Krill Oil Premium'] },
  { codigo: 'TP-051', nombre: 'PepZin GI', alias: ['Zinc Carnosine'], principioActivo: 'Zinc-L-Carnosina' },
  { codigo: 'TP-052', nombre: 'Aceite de Semilla de Calabaza', alias: ['Pumpkin Seed Oil'] },
  { codigo: 'TP-053', nombre: 'Refuerzo de Cándida', alias: ['Candida Support'] },
  { codigo: 'TP-054', nombre: 'Resveratrol', principioActivo: 'Trans-Resveratrol' },
  { codigo: 'TP-055', nombre: 'Icy Hot', alias: ['Roll On', 'Spray'] },
  { codigo: 'TP-056', nombre: 'Selenio', principioActivo: 'Selenometionina' },
  { codigo: 'TP-057', nombre: 'Shilajit', principioActivo: 'Ácido Fúlvico' },
  { codigo: 'TP-058', nombre: 'Espirulina', alias: ['Spirulina', 'Chlorella'] },
  { codigo: 'TP-059', nombre: 'Tongkat Ali', alias: ['Longjack'], principioActivo: 'Eurycoma longifolia' },
  { codigo: 'TP-060', nombre: 'Vinagre de Manzana', alias: ['Apple Cider Vinegar'] },
  { codigo: 'TP-061', nombre: 'Vitamina E', principioActivo: 'Tocoferoles mixtos' },
  { codigo: 'TP-062', nombre: 'Sulfato de Zinc', alias: ['Zinc Iónico'] }
];

// ============================================================================
// MAPEO SUBGRUPO -> TIPO PRODUCTO (normalizado)
// ============================================================================

export const MAPEO_SUBGRUPO_TIPO: Record<string, string> = {
  '5-HTP': 'TP-001',
  'PROBIOTICOS + PREBIOTICOS': 'TP-002',
  'D3 + OMEGA 3': 'TP-003',
  'ACEITE DE OREGANO': 'TP-004',
  'MULTIVITAMINICO PARA ADULTOS': 'TP-005',
  'ALLISURE POWDER': 'TP-006',
  'ALPHA LIPOIC ACID': 'TP-007',
  'KRILL OIL': 'TP-008',
  'ASHWAGHANDA': 'TP-009',
  'ASTANXATINA': 'TP-010',
  'VITAMINA B12': 'TP-011',
  'BERBERINA': 'TP-012',
  'BORO': 'TP-013',
  'D3 + CALCIUM + ZINC': 'TP-014',
  'MULTIVITAMINICO PARA MUJER': 'TP-015',
  'MULTIVITAMINICO PARA NIÑO': 'TP-016',
  'CITICOLINE CDP': 'TP-017',
  'CITRATO DE MAGNESIO': 'TP-018',
  'COLAGENO': 'TP-019',
  'COMPLEJO B': 'TP-020',
  'OMEGA 3 + GLA': 'TP-021',
  'COQ 10': 'TP-022',
  'D3': 'TP-023',
  'D3 + K2': 'TP-024',
  'D + B12': 'TP-025',
  'EXTRACTO HUMICO MOLECULAR': 'TP-026',
  'ENZIMAS DIGESTIVAS': 'TP-027',
  '5-MTHF': 'TP-028',
  'GINGKO BILOBA': 'TP-029',
  'GLUCOSAMINA CONDROITINA': 'TP-030',
  'OMEGA 3': 'TP-031',
  'MULTIVITAMINICO PARA HOMBRE': 'TP-032',
  'KSM 66 + ASHWAGHANDA': 'TP-033',
  'L-TEANINA': 'TP-034',
  'MAGNESIO L-TREONATO': 'TP-035',
  'EXTRACTO HERBAL': 'TP-036',
  'MELENA DE LEON': 'TP-037',
  'VITAMINA C': 'TP-038',
  'LUTEINA': 'TP-039',
  'GLICINATO DE MAGNESIO': 'TP-040',
  'MAGNESIO + ASHWAGHANDA': 'TP-041',
  'BISGLICINATO DE MAGNESIO': 'TP-042',
  'MELATONINA': 'TP-043',
  'MELATONINA + L-TEANINA': 'TP-044',
  'CARDO MARIANO': 'TP-045',
  'MULTIVITAMINICO': 'TP-046',
  'MYO INOSITOL': 'TP-047',
  'NAD': 'TP-048',
  'RESVERATROL + NAD': 'TP-049',
  'OMEGA 3 + ASTAXANTINA': 'TP-050',
  'PEPZINGI': 'TP-051',
  'ACEITE DE SEMILLA DE CALABAZA': 'TP-052',
  'REFUERZO DE CANDIDA': 'TP-053',
  'RESVERATROL': 'TP-054',
  'ICY HOT': 'TP-055',
  'SELENIO': 'TP-056',
  'SHILAJIT': 'TP-057',
  'SPIRULINA': 'TP-058',
  'LONGJACK': 'TP-059',
  'VINAGRE DE MANZANA': 'TP-060',
  'VITAMINA E': 'TP-061',
  'SULFATO DE ZINC': 'TP-062'
};

// ============================================================================
// MAPEO FIELD11 (categoría legacy) -> CATEGORÍAS CORREGIDAS
// ============================================================================

export const MAPEO_CATEGORIA_LEGACY: Record<string, string[]> = {
  'SISTEMA INMUNE': ['CAT-001'],
  'SALUD DIGESTIVA': ['CAT-002'],
  'SUEÑO Y RELAJACION': ['CAT-005'],
  'MULTIVITAMINICOS': ['CAT-011'],
  'SALUD COGNITIVA': ['CAT-004'],
  'SALUD VISUAL': ['CAT-012'],
  'SALUD HEPATICA': ['CAT-013'],
  'SALUD CELULAR': ['CAT-014'],
  'USO TOPICO': ['CAT-015'],
  'SALUD HORMONAL': ['CAT-009'],
  'SALUD OSEA': ['CAT-008'],
  'SALUD CARDIOVASCULAR Y CEREBRAL': ['CAT-003', 'CAT-004'],
  'SALUD OSEA Y CARDIOVASCULAR': ['CAT-008', 'CAT-003'],
  'SALUD OSEA E INMUNE': ['CAT-008', 'CAT-001'],
  'SALUD OSEA / HORMONAL': ['CAT-008', 'CAT-009'],
  'MANEJO DEL ESTRES Y ENERGIIA': ['CAT-006', 'CAT-007'],
  'MANEJO DEL ESTRES Y ENERGIA': ['CAT-006', 'CAT-007'],
  'ENERGIA Y SISTEMA NERVIOSO': ['CAT-006'],
  'ANTIOXIDANTE Y METABOLISMO': ['CAT-010'],
  'METABOLISMO Y AZUCAR EN SANGRE': ['CAT-010'],
  'PIEL, ARTICULACIONES Y HUESOS': ['CAT-016', 'CAT-008']
};

// ============================================================================
// DATOS DE PRODUCTOS PARA MIGRACIÓN - Title Case aplicado
// ============================================================================

export interface ProductoMigracion {
  nombreLegacy: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  dosaje: string;
  contenido: string;
  servingSize: string;
  sabor: string;
  subgrupoLegacy: string;
  categoriaLegacy: string;
  tipoProductoCodigo: string;
  categoriasCodigos: string[];
}

export const PRODUCTOS_MIGRACION: ProductoMigracion[] = [
  {
    nombreLegacy: '5 HTP - NOW',
    marca: 'Now Foods',
    nombreComercial: '5-HTP',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '100 mg',
    contenido: '120',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: '5-HTP',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-001',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: '60 BILLION PROBIOTIC - PHYSIANS CHOICE',
    marca: "Physician's Choice",
    nombreComercial: '60 Billion Probiotic',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '30',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'PROBIOTICOS + PREBIOTICOS',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-002',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'ACEITE DE HIGADO DE BACALAO CON D3 - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Artic-D',
    presentacion: 'Líquido',
    dosaje: '1000 UI + 1060 mg',
    contenido: '8 oz',
    servingSize: '0.17',
    sabor: 'Limón',
    subgrupoLegacy: 'D3 + OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-003',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ACEITE DE OREGANO - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Aceite de Orégano',
    presentacion: 'Cápsulas Blandas de Liberación Rápida',
    dosaje: '4000 mg',
    contenido: '150',
    servingSize: '2.0',
    sabor: 'Orégano',
    subgrupoLegacy: 'ACEITE DE OREGANO',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-004',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'ACEITE DE OREGANO 2 OZ LIQUIDO - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Aceite de Orégano',
    presentacion: 'Gotero',
    dosaje: '34 mg',
    contenido: '2 oz',
    servingSize: '26',
    sabor: 'Orégano',
    subgrupoLegacy: 'ACEITE DE OREGANO',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-004',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'ADULT GUMMIES 160 - KIRKLAND',
    marca: 'Kirkland Signature',
    nombreComercial: 'Multivitamínico para Adultos',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '160',
    servingSize: '2.0',
    sabor: 'Fresa y Bayas',
    subgrupoLegacy: 'MULTIVITAMINICO PARA ADULTOS',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-005',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'ALLISURE POWDER - ALLIMAX',
    marca: 'Allimax',
    nombreComercial: 'Allisure Powder',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '180 mg',
    contenido: '30',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ALLISURE POWDER',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-006',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'ALPHA LIPOIC ACID - MICROINGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Alpha Lipoic Acid',
    presentacion: 'Cápsulas Blandas',
    dosaje: '600 mg',
    contenido: '120',
    servingSize: '3.0',
    sabor: 'Coco',
    subgrupoLegacy: 'ALPHA LIPOIC ACID',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-007',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'ANTARTIC KRILL OIL - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Antartic Krill Oil',
    presentacion: 'Cápsulas Blandas de Liberación Rápida',
    dosaje: '2000 mg + 600 mcg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'KRILL OIL',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-008',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ASHWAGHANDA - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Ashwagandha',
    presentacion: 'Cápsulas Blandas',
    dosaje: '3000 mg',
    contenido: '300',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ASHWAGHANDA',
    categoriaLegacy: 'MANEJO DEL ESTRES Y ENERGIIA',
    tipoProductoCodigo: 'TP-009',
    categoriasCodigos: ['CAT-006', 'CAT-007']
  },
  {
    nombreLegacy: 'ASHWAGHANDA - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Ashwagandha',
    presentacion: 'Cápsulas',
    dosaje: '450 mg',
    contenido: '120',
    servingSize: '4.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ASHWAGHANDA',
    categoriaLegacy: 'MANEJO DEL ESTRES Y ENERGIIA',
    tipoProductoCodigo: 'TP-009',
    categoriasCodigos: ['CAT-006', 'CAT-007']
  },
  {
    nombreLegacy: 'ASHWAGHANDA - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Ashwagandha',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '450 mg',
    contenido: '90',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ASHWAGHANDA',
    categoriaLegacy: 'MANEJO DEL ESTRES Y ENERGIIA',
    tipoProductoCodigo: 'TP-009',
    categoriasCodigos: ['CAT-006', 'CAT-007']
  },
  {
    nombreLegacy: 'ASTAXANTINA 12 MG - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Astaxantina',
    presentacion: 'Cápsulas Blandas',
    dosaje: '12 mg',
    contenido: '120',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ASTANXATINA',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-010',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'B12 - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Vitamina B12',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '5000 mcg',
    contenido: '250',
    servingSize: '1.0',
    sabor: 'Bayas',
    subgrupoLegacy: 'VITAMINA B12',
    categoriaLegacy: 'ENERGIA Y SISTEMA NERVIOSO',
    tipoProductoCodigo: 'TP-011',
    categoriasCodigos: ['CAT-006']
  },
  {
    nombreLegacy: 'BERBERINA - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Berberina',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '500000 mcg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'BERBERINA',
    categoriaLegacy: 'METABOLISMO Y AZUCAR EN SANGRE',
    tipoProductoCodigo: 'TP-012',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'BERBERINA - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Berberina',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '2000 mg',
    contenido: '120',
    servingSize: '1.0',
    sabor: 'Canela',
    subgrupoLegacy: 'BERBERINA',
    categoriaLegacy: 'METABOLISMO Y AZUCAR EN SANGRE',
    tipoProductoCodigo: 'TP-012',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'BORO - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Boro',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '3 mg',
    contenido: '250',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'BORO',
    categoriaLegacy: 'SALUD OSEA / HORMONAL',
    tipoProductoCodigo: 'TP-013',
    categoriasCodigos: ['CAT-008', 'CAT-009']
  },
  {
    nombreLegacy: 'CALCIUM, D3 AND ZINC - KIRKLAND',
    marca: 'Kirkland Signature',
    nombreComercial: 'Calcium, D3 y Zinc',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Frutas Tropicales',
    subgrupoLegacy: 'D3 + CALCIUM + ZINC',
    categoriaLegacy: 'SALUD OSEA',
    tipoProductoCodigo: 'TP-014',
    categoriasCodigos: ['CAT-008']
  },
  {
    nombreLegacy: 'CAPSULAS MULTIVITAMINICAS MUJER + 50 - CENTRUM',
    marca: 'Centrum',
    nombreComercial: 'Cápsulas Multivitamínicas de Mujer',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '275',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MULTIVITAMINICO PARA MUJER',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-015',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'CHILDREN GUMMIES 160 - KIRKLAND',
    marca: 'Kirkland Signature',
    nombreComercial: 'Gomitas Multivitamínicas de Niño',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '160',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MULTIVITAMINICO PARA NIÑO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-016',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'CITICOLINE CDP - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Citicoline CDP',
    presentacion: 'Cápsulas',
    dosaje: '1000 mg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'CITICOLINE CDP',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-017',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'CITRATO  DE MAGNESIO GOMITAS - DR MORITZ',
    marca: 'Dr. Moritz',
    nombreComercial: 'Citrato de Magnesio',
    presentacion: 'Gomitas',
    dosaje: '100 mg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Frambuesa',
    subgrupoLegacy: 'CITRATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-018',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'COLLAGEN + BIOTIN 390 - YOUTHEORY',
    marca: 'Youtheory',
    nombreComercial: 'Collagen + Biotin',
    presentacion: 'Tabletas',
    dosaje: '6000 mg + 3000 mcg',
    contenido: '390',
    servingSize: '6.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COLAGENO',
    categoriaLegacy: 'PIEL, ARTICULACIONES Y HUESOS',
    tipoProductoCodigo: 'TP-019',
    categoriasCodigos: ['CAT-016', 'CAT-008']
  },
  {
    nombreLegacy: 'COMPLEJO B - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'Complejo B',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '-',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COMPLEJO B',
    categoriaLegacy: 'ENERGIA Y SISTEMA NERVIOSO',
    tipoProductoCodigo: 'TP-020',
    categoriasCodigos: ['CAT-006']
  },
  {
    nombreLegacy: 'COMPLEJO B - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Complejo B',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '240',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COMPLEJO B',
    categoriaLegacy: 'ENERGIA Y SISTEMA NERVIOSO',
    tipoProductoCodigo: 'TP-020',
    categoriasCodigos: ['CAT-006']
  },
  {
    nombreLegacy: 'COMPLETE OMEGA JUNIOR LIMON CAPSULAS 180 - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Complete Omega Junior',
    presentacion: 'Mini Cápsulas Blandas',
    dosaje: '283 mg + 35 mg',
    contenido: '180',
    servingSize: '2.0',
    sabor: 'Limón',
    subgrupoLegacy: 'OMEGA 3 + GLA',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-021',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'COQ 10 - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'CoQ10',
    presentacion: 'Cápsulas Blandas',
    dosaje: '100 mg',
    contenido: '240',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COQ 10',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-022',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'D3 10000IU - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Vitamina D3',
    presentacion: 'Cápsulas Blandas',
    dosaje: '10000 IU',
    contenido: '400',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3',
    categoriaLegacy: 'SALUD OSEA E INMUNE',
    tipoProductoCodigo: 'TP-023',
    categoriasCodigos: ['CAT-008', 'CAT-001']
  },
  {
    nombreLegacy: 'D3 5000IU - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Vitamina D3',
    presentacion: 'Cápsulas Blandas',
    dosaje: '5000 IU',
    contenido: '500',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3',
    categoriaLegacy: 'SALUD OSEA E INMUNE',
    tipoProductoCodigo: 'TP-023',
    categoriasCodigos: ['CAT-008', 'CAT-001']
  },
  {
    nombreLegacy: 'D3 K2 - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'D3 + K2',
    presentacion: 'Cápsulas Blandas',
    dosaje: '10000 IU + 200 mcg',
    contenido: '300',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3 + K2',
    categoriaLegacy: 'SALUD OSEA Y CARDIOVASCULAR',
    tipoProductoCodigo: 'TP-024',
    categoriasCodigos: ['CAT-008', 'CAT-003']
  },
  {
    nombreLegacy: 'D3 K2 - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'D3 + K2',
    presentacion: 'Cápsulas Blandas',
    dosaje: '5000 IU + 100 mcg',
    contenido: '300',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3 + K2',
    categoriaLegacy: 'SALUD OSEA Y CARDIOVASCULAR',
    tipoProductoCodigo: 'TP-024',
    categoriasCodigos: ['CAT-008', 'CAT-003']
  },
  {
    nombreLegacy: 'D3 K2 - NOW',
    marca: 'Now Foods',
    nombreComercial: 'D3 + K2',
    presentacion: 'Cápsulas',
    dosaje: '1000 IU + 45 mcg',
    contenido: '120',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3 + K2',
    categoriaLegacy: 'SALUD OSEA Y CARDIOVASCULAR',
    tipoProductoCodigo: 'TP-024',
    categoriasCodigos: ['CAT-008', 'CAT-003']
  },
  {
    nombreLegacy: 'D3 K2 10000 - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'D3 + K2',
    presentacion: 'Cápsulas Blandas',
    dosaje: '10000 IU + 200 mcg',
    contenido: '300',
    servingSize: '1.0',
    sabor: 'Coco',
    subgrupoLegacy: 'D3 + K2',
    categoriaLegacy: 'SALUD OSEA Y CARDIOVASCULAR',
    tipoProductoCodigo: 'TP-024',
    categoriasCodigos: ['CAT-008', 'CAT-003']
  },
  {
    nombreLegacy: 'D3 K2 5000 - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'D3 + K2',
    presentacion: 'Cápsulas Blandas',
    dosaje: '5000 IU + 100 mcg',
    contenido: '300',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3 + K2',
    categoriaLegacy: 'SALUD OSEA Y CARDIOVASCULAR',
    tipoProductoCodigo: 'TP-024',
    categoriasCodigos: ['CAT-008', 'CAT-003']
  },
  {
    nombreLegacy: 'DETOXZEE - JOYSPRING',
    marca: 'Joyspring',
    nombreComercial: 'Detoxzee',
    presentacion: 'Gotero',
    dosaje: '200 IU + 300 mcg',
    contenido: '1 oz',
    servingSize: '33',
    sabor: 'Bayas',
    subgrupoLegacy: 'D + B12',
    categoriaLegacy: 'ENERGIA Y SISTEMA NERVIOSO',
    tipoProductoCodigo: 'TP-025',
    categoriasCodigos: ['CAT-006']
  },
  {
    nombreLegacy: 'DIGESTIVE DROPS - COCO MARCH',
    marca: 'Coco March',
    nombreComercial: 'Digestive Drops',
    presentacion: 'Gotero',
    dosaje: '200 mg',
    contenido: '1 oz',
    servingSize: '14',
    sabor: 'Neutral',
    subgrupoLegacy: 'EXTRACTO HUMICO MOLECULAR',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-026',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'ENZIMAS DIGESTIVAS - PHYSIANS CHOICE',
    marca: "Physician's Choice",
    nombreComercial: 'Enzimas Digestivas',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '60',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ENZIMAS DIGESTIVAS',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-027',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'FOLATO OPTIMIZADO - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'Folato Optimizado',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '1700 mcg',
    contenido: '100',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: '5-MTHF',
    categoriaLegacy: 'SALUD CELULAR',
    tipoProductoCodigo: 'TP-028',
    categoriasCodigos: ['CAT-014']
  },
  {
    nombreLegacy: 'GINKGO LOBA - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Ginkgo Biloba',
    presentacion: 'Cápsulas Blandas',
    dosaje: '120 mg',
    contenido: '400',
    servingSize: '2.0',
    sabor: 'Coco',
    subgrupoLegacy: 'GINGKO BILOBA',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-029',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'GLUCOSAMINA CONDROITINA - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Glucosamina Condroitina',
    presentacion: 'Tableta Bisectada',
    dosaje: '4000 mg',
    contenido: '300',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'GLUCOSAMINA CONDROITINA',
    categoriaLegacy: 'SALUD OSEA',
    tipoProductoCodigo: 'TP-030',
    categoriasCodigos: ['CAT-008']
  },
  {
    nombreLegacy: 'GOMITAS DHA XTRA - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Zero Azúcar DHA para Niños',
    presentacion: 'Gomitas',
    dosaje: '600 mg',
    contenido: '30',
    servingSize: '1.0',
    sabor: 'Frutas Cítricas',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'GOMITAS MASTICABLES DHA 45 - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Zero Azúcar DHA para Niños',
    presentacion: 'Gomitas',
    dosaje: '600 mg',
    contenido: '45',
    servingSize: '1.0',
    sabor: 'Frutas Cítricas',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'GOMITAS MULTIVITAMINICAS HOMBRE +50 - CENTRUM',
    marca: 'Centrum',
    nombreComercial: 'Gomitas Multivitamínicas de Hombre',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '170',
    servingSize: '2.0',
    sabor: 'Frutas Tropicales',
    subgrupoLegacy: 'MULTIVITAMINICO PARA HOMBRE',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-032',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'GOMITAS MULTIVITAMINICAS MUJER +50 - CENTRUM',
    marca: 'Centrum',
    nombreComercial: 'Gomitas Multivitamínicas de Mujer',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '170',
    servingSize: '2.0',
    sabor: 'Frutas Tropicales',
    subgrupoLegacy: 'MULTIVITAMINICO PARA MUJER',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-015',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'GOTAS GENIUS - JOYPSRING',
    marca: 'Joyspring',
    nombreComercial: 'Gotas Genius',
    presentacion: 'Gotero',
    dosaje: '-',
    contenido: '1 oz',
    servingSize: '33',
    sabor: 'Neutral',
    subgrupoLegacy: 'GINGKO BILOBA',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-029',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'KIDS MULTIVITAMIN - LIL CRITTERS',
    marca: "Lil Critter's",
    nombreComercial: 'Gomitas Multivitamínicas de Niño',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '300',
    servingSize: '2.0',
    sabor: 'Frutas Tropicales',
    subgrupoLegacy: 'MULTIVITAMINICO PARA NIÑO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-016',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'KRILL OIL - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Krill Oil',
    presentacion: 'Cápsulas Blandas de Liberación Rápida',
    dosaje: '2000 mg + 600 mcg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3 + ASTAXANTINA',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-050',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'KRILL OIL - MICROINGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Krill Oil',
    presentacion: 'Cápsulas Blandas',
    dosaje: '2000 mg + 800 mcg',
    contenido: '240',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3 + ASTAXANTINA',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-050',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'KSM 66 + ASHWAGHANDA - NOW',
    marca: 'Now Foods',
    nombreComercial: 'KSM-66 + Ashwagandha',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '600 mg',
    contenido: '90',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'KSM 66 + ASHWAGHANDA',
    categoriaLegacy: 'MANEJO DEL ESTRES Y ENERGIIA',
    tipoProductoCodigo: 'TP-033',
    categoriasCodigos: ['CAT-006', 'CAT-007']
  },
  {
    nombreLegacy: 'KSM 66 ASHWAGHANDA - NOW',
    marca: 'Now Foods',
    nombreComercial: 'KSM-66 + Ashwagandha',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '600 mg',
    contenido: '90',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'KSM 66 + ASHWAGHANDA',
    categoriaLegacy: 'MANEJO DEL ESTRES Y ENERGIIA',
    tipoProductoCodigo: 'TP-033',
    categoriasCodigos: ['CAT-006', 'CAT-007']
  },
  {
    nombreLegacy: 'L TEANINA - NOW',
    marca: 'Now Foods',
    nombreComercial: 'L-Teanina',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '100 mg',
    contenido: '90',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'L-TEANINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-034',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'L THEANINE - NOW',
    marca: 'Now Foods',
    nombreComercial: 'L-Teanina',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '100 mg',
    contenido: '90',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'L-TEANINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-034',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'L TREONATO DE MAGNESIO - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'Magtein',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '144 mg',
    contenido: '90',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MAGNESIO L-TREONATO',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-035',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'LINGO LEAP - JOYSPRING',
    marca: 'Joyspring',
    nombreComercial: 'Lingo Leap',
    presentacion: 'Gotero',
    dosaje: '-',
    contenido: '1 oz',
    servingSize: '33',
    sabor: 'Frambuesas',
    subgrupoLegacy: 'EXTRACTO HERBAL',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-036',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'LIONS MANE 2 OZ LIQUIDO - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Melena de León',
    presentacion: 'Gotero',
    dosaje: '2 ml',
    contenido: '2 oz',
    servingSize: '66',
    sabor: 'Neutral',
    subgrupoLegacy: 'MELENA DE LEON',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-037',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'LIPOSOMAL - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Vitamina C Liposomal',
    presentacion: 'Cápsulas Blandas',
    dosaje: '2200 mg',
    contenido: '90',
    servingSize: '2.0',
    sabor: 'Naranja',
    subgrupoLegacy: 'VITAMINA C',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-038',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'LUTEINA - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Luteína',
    presentacion: 'Cápsulas Blandas',
    dosaje: '40 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'LUTEINA',
    categoriaLegacy: 'SALUD VISUAL',
    tipoProductoCodigo: 'TP-039',
    categoriasCodigos: ['CAT-012']
  },
  {
    nombreLegacy: 'LUTEINA 40MG - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Luteína',
    presentacion: 'Cápsulas Blandas',
    dosaje: '40 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'LUTEINA',
    categoriaLegacy: 'SALUD VISUAL',
    tipoProductoCodigo: 'TP-039',
    categoriasCodigos: ['CAT-012']
  },
  {
    nombreLegacy: 'MAGNESIO GLYCINATE - DOCTOR BEST',
    marca: "Doctor's Best",
    nombreComercial: 'Magnesio Glicinato',
    presentacion: 'Tabletas',
    dosaje: '200 mg',
    contenido: '240',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'GLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-040',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESIO GLYCINATE - DOUBLE WOOD',
    marca: 'Double Wood',
    nombreComercial: 'Magnesio Glicinato',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '400 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'GLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-040',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESIUM + ASHWAGHANDA - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Magnesio + Ashwagandha',
    presentacion: 'Cápsulas Blandas',
    dosaje: '150 mg + 1500 mg',
    contenido: '120',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MAGNESIO + ASHWAGHANDA',
    categoriaLegacy: 'MANEJO DEL ESTRES Y ENERGIIA',
    tipoProductoCodigo: 'TP-041',
    categoriasCodigos: ['CAT-006', 'CAT-007']
  },
  {
    nombreLegacy: 'MAGNESIUM BISGLICINATE - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Magnesio Bisglicinato',
    presentacion: 'Cápsulas',
    dosaje: '665 mg',
    contenido: '250',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'BISGLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-042',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESIUM BYSGLINATE - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Magnesio Bisglicinato',
    presentacion: 'Cápsulas',
    dosaje: '665 mg',
    contenido: '250',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'BISGLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-042',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESIUM FOR KIDS - DR. MORITZ',
    marca: 'Dr. Moritz',
    nombreComercial: 'Magnesio para Niños',
    presentacion: 'Gomitas',
    dosaje: '100 mg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Frambuesa',
    subgrupoLegacy: 'CITRATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-018',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESIUM GLYCINATE - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Magnesio Glicinato',
    presentacion: 'Cápsulas',
    dosaje: '1330 mg',
    contenido: '250',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'GLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-040',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESIUM GLYCINATE - SOLARAY',
    marca: 'Solaray',
    nombreComercial: 'Magnesio Glicinato',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '350 mg',
    contenido: '120',
    servingSize: '4.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'GLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-040',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGNESYUM GLYCYNATE - DOUBLE WOOD',
    marca: 'Double Wood',
    nombreComercial: 'Magnesio Glicinato',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '400 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'GLICINATO DE MAGNESIO',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-040',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MAGTEIN - DOUBLE WOOD',
    marca: 'Double Wood',
    nombreComercial: 'Magtein',
    presentacion: 'Cápsulas',
    dosaje: '2000 mg',
    contenido: '120',
    servingSize: '4.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MAGNESIO L-TREONATO',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-035',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'MELATONINA - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Melatonina',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '5 mg',
    contenido: '200',
    servingSize: '1.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA & L TEANINA KIDS 60 - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Melatonina + L-Teanina para Niños',
    presentacion: 'Gomitas',
    dosaje: '1 mg + 25 mg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA + L-TEANINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-044',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA 200 - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Melatonina',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '5 mg',
    contenido: '200',
    servingSize: '1.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA 20MG - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Melatonina',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '20 mg',
    contenido: '400',
    servingSize: '1.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA 250 - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Melatonina',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '5 mg',
    contenido: '250',
    servingSize: '1.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA 40MG - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Melatonina',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '40 mg',
    contenido: '150',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA 5 MG 300 - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Melatonina',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '5 mg',
    contenido: '300',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA GOMITAS 10 MG - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Gomitas de Melatonina para Adultos',
    presentacion: 'Gomitas',
    dosaje: '10 mg',
    contenido: '190',
    servingSize: '2.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA KIDS 140 - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Gomitas de Melatonina para Niños',
    presentacion: 'Gomitas',
    dosaje: '1 mg',
    contenido: '140',
    servingSize: '1.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA KIDS 90 - NATROL',
    marca: 'Natrol',
    nombreComercial: 'Gomitas de Melatonina para Niños',
    presentacion: 'Gomitas',
    dosaje: '1 mg',
    contenido: '90',
    servingSize: '1.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELATONINA TABLETAS 12 MG - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Melatonina para Adultos',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '12 mg',
    contenido: '300',
    servingSize: '1.0',
    sabor: 'Bayas',
    subgrupoLegacy: 'MELATONINA',
    categoriaLegacy: 'SUEÑO Y RELAJACION',
    tipoProductoCodigo: 'TP-043',
    categoriasCodigos: ['CAT-005']
  },
  {
    nombreLegacy: 'MELENA DE LEON - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Melena de León',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '4200 mg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MELENA DE LEON',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-037',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'METHYLFOLATE - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: '5-MTHF',
    presentacion: 'Cápsulas',
    dosaje: '1000 mcg',
    contenido: '200',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: '5-MTHF',
    categoriaLegacy: 'SALUD CELULAR',
    tipoProductoCodigo: 'TP-028',
    categoriasCodigos: ['CAT-014']
  },
  {
    nombreLegacy: 'MILK THISTLE/CARDO MARIANO - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Cardo Mariano',
    presentacion: 'Cápsulas',
    dosaje: '3000 mg',
    contenido: '300',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'CARDO MARIANO',
    categoriaLegacy: 'SALUD HEPATICA',
    tipoProductoCodigo: 'TP-045',
    categoriasCodigos: ['CAT-013']
  },
  {
    nombreLegacy: 'MULTI COLLAGEN - SPORTS RESEARCH',
    marca: 'Sports Research',
    nombreComercial: 'Multi Colágeno',
    presentacion: 'Cápsulas',
    dosaje: '1600 mg',
    contenido: '90',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COLAGENO',
    categoriaLegacy: 'SALUD OSEA',
    tipoProductoCodigo: 'TP-019',
    categoriasCodigos: ['CAT-008']
  },
  {
    nombreLegacy: 'MULTIVITAMIN ADULTS 200 - CENTRUM',
    marca: 'Centrum',
    nombreComercial: 'Cápsulas Multivitamínicas de Adulto',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '200',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MULTIVITAMINICO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-046',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'MULTIVITAMIN MENS 200 - CENTRUM',
    marca: 'Centrum',
    nombreComercial: 'Cápsulas Multivitamínicas de Hombre',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '200',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MULTIVITAMINICO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-046',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'MULTIVITAMINICO LIQUIDO 450ML FRAMBUESA - MARY RUTH',
    marca: "Mary Ruth's",
    nombreComercial: 'Líquido Multivitamínico',
    presentacion: 'Líquido',
    dosaje: '-',
    contenido: '15.22 oz',
    servingSize: '1.014',
    sabor: 'Frambuesa',
    subgrupoLegacy: 'MULTIVITAMINICO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-046',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'MULTIVITAMINICO PARA EL CABELLO 450ML MANGO - MARY RUTH',
    marca: "Mary Ruth's",
    nombreComercial: 'Líquido Multivitamínico + Crecimiento del Cabello',
    presentacion: 'Líquido',
    dosaje: '-',
    contenido: '15.22 oz',
    servingSize: '1.014',
    sabor: 'Mango',
    subgrupoLegacy: 'MULTIVITAMINICO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-046',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'MYO INOSITOL - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Myo Inositol',
    presentacion: 'Cápsulas',
    dosaje: '2060 mg',
    contenido: '150',
    servingSize: '4.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MYO INOSITOL',
    categoriaLegacy: 'SALUD HORMONAL',
    tipoProductoCodigo: 'TP-047',
    categoriasCodigos: ['CAT-009']
  },
  {
    nombreLegacy: 'NAD+ - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'NAD+',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '100 mg',
    contenido: '30',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'NAD',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-048',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'NAD+ RESVERATROL - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'NAD + Resveratrol',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '55 mg + 300 mg',
    contenido: '30',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'RESVERATROL + NAD',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-049',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'NEUROMAG - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'Neuromag',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '144 mg',
    contenido: '90',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MAGNESIO L-TREONATO',
    categoriaLegacy: 'SALUD COGNITIVA',
    tipoProductoCodigo: 'TP-035',
    categoriasCodigos: ['CAT-004']
  },
  {
    nombreLegacy: 'OIL OF OREGANO - MICROINGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Aceite de Orégano',
    presentacion: 'Cápsulas Blandas',
    dosaje: '6000 mg',
    contenido: '300',
    servingSize: '2.0',
    sabor: 'Orégano',
    subgrupoLegacy: 'ACEITE DE OREGANO',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-004',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'OIL OF OREGANO - PIPPING ROCK',
    marca: 'Piping Rock',
    nombreComercial: 'Aceite de Orégano',
    presentacion: 'Cápsulas Blandas de Liberación Rápida',
    dosaje: '4000 mg',
    contenido: '200',
    servingSize: '2.0',
    sabor: 'Orégano',
    subgrupoLegacy: 'ACEITE DE OREGANO',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-004',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'OMEGA 3 - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Omega 3',
    presentacion: 'Cápsulas Blandas',
    dosaje: '4200 mg',
    contenido: '240',
    servingSize: '3.0',
    sabor: 'Limón',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'OMEGA 3 ALASKA - SPORTS RESEARCH',
    marca: 'Sports Research',
    nombreComercial: 'Alaska Omega 3',
    presentacion: 'Cápsulas Blandas',
    dosaje: '1040 mg',
    contenido: '90',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'OMEGA 3 LIMON - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Omega 3',
    presentacion: 'Líquido',
    dosaje: '1560 mg',
    contenido: '8 oz',
    servingSize: '0.17',
    sabor: 'Limón',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'OMEGA 369 - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Omega 369',
    presentacion: 'Cápsulas Blandas',
    dosaje: '1400 mg',
    contenido: '250',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ORGANIC KIDS METHYLFOLATO - TRIQUETRA',
    marca: 'Triquetra',
    nombreComercial: 'Folato de Metilo Orgánico para Niños',
    presentacion: 'Gotero',
    dosaje: '1 oz',
    contenido: '1 oz',
    servingSize: '0.04',
    sabor: 'Bayas',
    subgrupoLegacy: '5-MTHF',
    categoriaLegacy: 'SALUD CELULAR',
    tipoProductoCodigo: 'TP-028',
    categoriasCodigos: ['CAT-014']
  },
  {
    nombreLegacy: 'PEPTIDOS DE COLAGENO - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Polvo de Péptidos de Colágeno',
    presentacion: 'Polvo',
    dosaje: '10888 mg',
    contenido: '1 lb',
    servingSize: '24',
    sabor: 'Neutral',
    subgrupoLegacy: 'COLAGENO',
    categoriaLegacy: 'SALUD OSEA',
    tipoProductoCodigo: 'TP-019',
    categoriasCodigos: ['CAT-008']
  },
  {
    nombreLegacy: 'PEPTIDOS DE COLAGENO CAPSULAS - MICROINGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Cápsulas de Péptidos de Colágeno',
    presentacion: 'Cápsulas',
    dosaje: '1100 mg',
    contenido: '240',
    servingSize: '3.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COLAGENO',
    categoriaLegacy: 'SALUD OSEA',
    tipoProductoCodigo: 'TP-019',
    categoriasCodigos: ['CAT-008']
  },
  {
    nombreLegacy: 'PEPZIN GI - DOCTORS BEST',
    marca: "Doctor's Best",
    nombreComercial: 'PepZin GI',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '75 mg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'PEPZINGI',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-051',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'PONCHE DHA BABY - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'DHA para Bebés',
    presentacion: 'Líquido',
    dosaje: '300 IU + 1050 mg',
    contenido: '2 oz',
    servingSize: '42',
    sabor: 'Neutral',
    subgrupoLegacy: 'D3 + OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-003',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'PONCHE DHA XTRA - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'DHA Xtra',
    presentacion: 'Líquido',
    dosaje: '880 mg',
    contenido: '2 oz',
    servingSize: '42',
    sabor: 'Bayas',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'PREBIOTIC PROBIOTIC 50 BILLION - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Prebióticos + Probióticos 50 Billion',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '142 mg + 200 mg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'PROBIOTICOS + PREBIOTICOS',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-002',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'PUMPKIN - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Cápsulas de Aceite de Semilla de Calabaza',
    presentacion: 'Cápsulas Blandas',
    dosaje: '3000 mg',
    contenido: '300',
    servingSize: '3.0',
    sabor: 'Calabaza',
    subgrupoLegacy: 'ACEITE DE SEMILLA DE CALABAZA',
    categoriaLegacy: 'SALUD HORMONAL',
    tipoProductoCodigo: 'TP-052',
    categoriasCodigos: ['CAT-009']
  },
  {
    nombreLegacy: 'REFUERZO CANDIDA - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Refuerzo de Cándida',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '-',
    contenido: '180',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'REFUERZO DE CANDIDA',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-053',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'RESVERATROL - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Resveratrol',
    presentacion: 'Cápsulas de Liberación Rápida',
    dosaje: '1800 mg',
    contenido: '180',
    servingSize: '3.0',
    sabor: 'Uva',
    subgrupoLegacy: 'RESVERATROL',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-054',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'RESVERATROL + NAD - WELLNESS',
    marca: 'Wellness Labs Rx',
    nombreComercial: 'NAD + Resveratrol',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '300 mg + 1200 mg',
    contenido: '90',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'RESVERATROL + NAD',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-049',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'ROLL ON - ICY HOT',
    marca: 'Icy Hot',
    nombreComercial: 'Icy Hot Roll On',
    presentacion: 'Roll On',
    dosaje: '-',
    contenido: '2.5 oz',
    servingSize: '28',
    sabor: 'Mentol',
    subgrupoLegacy: 'ICY HOT',
    categoriaLegacy: 'USO TOPICO',
    tipoProductoCodigo: 'TP-055',
    categoriasCodigos: ['CAT-015']
  },
  {
    nombreLegacy: 'SELENIUM - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Selenio',
    presentacion: 'Cápsulas Vegetales',
    dosaje: '200 mcg',
    contenido: '200',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'SELENIO',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-056',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'SHILAJIT - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Shilajit',
    presentacion: 'Cápsulas de Liberación Rápida',
    dosaje: '2000 mg',
    contenido: '90',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'SHILAJIT',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-057',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'SPIRULINA CHLORELLA - MICRO INGREDIENTS',
    marca: 'Microingredients',
    nombreComercial: 'Espirulina de Chlorella',
    presentacion: 'Pastillas',
    dosaje: '3000 mg',
    contenido: '720',
    servingSize: '6.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'SPIRULINA',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-058',
    categoriasCodigos: ['CAT-001']
  },
  {
    nombreLegacy: 'SPRAY - ICY HOT',
    marca: 'Icy Hot',
    nombreComercial: 'Icy Hot Spray',
    presentacion: 'Spray',
    dosaje: '-',
    contenido: '4 oz',
    servingSize: '44',
    sabor: 'Mentol',
    subgrupoLegacy: 'ICY HOT',
    categoriaLegacy: 'USO TOPICO',
    tipoProductoCodigo: 'TP-055',
    categoriasCodigos: ['CAT-015']
  },
  {
    nombreLegacy: 'SUPER ENZIMAS - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Super Enzimas',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'ENZIMAS DIGESTIVAS',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-027',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'SUPER OMEGA 3 PLUS - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'Super Omega 3 Plus',
    presentacion: 'Cápsulas Blandas',
    dosaje: '2350 mg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'SUPER UBIQUINOL COQ 10 100MG - LIFE EXTENSION',
    marca: 'Life Extension',
    nombreComercial: 'CoQ10',
    presentacion: 'Cápsulas Blandas',
    dosaje: '100 mg',
    contenido: '60',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COQ 10',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-022',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'TONGKAT ALI - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Tongkat Ali',
    presentacion: 'Cápsulas de Liberación Rápida',
    dosaje: '1600 mg',
    contenido: '120',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'LONGJACK',
    categoriaLegacy: 'SALUD HORMONAL',
    tipoProductoCodigo: 'TP-059',
    categoriasCodigos: ['CAT-009']
  },
  {
    nombreLegacy: 'ULTIMA OMEGA ADOLESCENTES 12 AÑOS FRESA CAPSULAS 60 - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Ultimate Omega Teen',
    presentacion: 'Mini Cápsulas Blandas',
    dosaje: '1120 mg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ULTIMA OMEGA LIMON 4OZ - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Ultimate Omega',
    presentacion: 'Líquido',
    dosaje: '2840 mg',
    contenido: '4 oz',
    servingSize: '0.17',
    sabor: 'Limón',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ULTIMA OMEGA NIÑOS 6 AÑOS FRESA CAPSULAS 90  - NORDIC NATURALS',
    marca: 'Nordic Naturals',
    nombreComercial: 'Ultimate Omega Kids',
    presentacion: 'Mini Cápsulas Blandas',
    dosaje: '680 mg',
    contenido: '90',
    servingSize: '2.0',
    sabor: 'Fresa',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ULTRA OMEGA 3 - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Ultra Omega 3 - Cerebro y Corazón',
    presentacion: 'Cápsulas Blandas',
    dosaje: '750 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ULTRA OMEGA 3 CARDIOVASCULAR - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Ultra Omega 3 - Cardiovascular',
    presentacion: 'Cápsulas Blandas',
    dosaje: '750 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'ULTRA OMEGA 3 HEART AND BRAIN - NOW',
    marca: 'Now Foods',
    nombreComercial: 'Ultra Omega 3 - Cerebro y Corazón',
    presentacion: 'Cápsulas Blandas',
    dosaje: '750 mg',
    contenido: '180',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'OMEGA 3',
    categoriaLegacy: 'SALUD CARDIOVASCULAR Y CEREBRAL',
    tipoProductoCodigo: 'TP-031',
    categoriasCodigos: ['CAT-003', 'CAT-004']
  },
  {
    nombreLegacy: 'VINAGRE DE MANZANA - NATURES TRUTH',
    marca: "Nature's Truth",
    nombreComercial: 'Vinagre de Manzana',
    presentacion: 'Cápsulas',
    dosaje: '1200 mg',
    contenido: '60',
    servingSize: '2.0',
    sabor: 'Manzana',
    subgrupoLegacy: 'VINAGRE DE MANZANA',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-060',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'VITAMINA B COMPLEX - CARLYLE',
    marca: 'Carlyle',
    nombreComercial: 'Vitamina B Complex',
    presentacion: 'Tabletas',
    dosaje: '-',
    contenido: '300',
    servingSize: '2.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'COMPLEJO B',
    categoriaLegacy: 'ENERGIA Y SISTEMA NERVIOSO',
    tipoProductoCodigo: 'TP-020',
    categoriasCodigos: ['CAT-006']
  },
  {
    nombreLegacy: 'VITAMINA B12 - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Vitamina B12',
    presentacion: 'Tableta de Disolución Rápida',
    dosaje: '5000 mcg',
    contenido: '120',
    servingSize: '1.0',
    sabor: 'Bayas',
    subgrupoLegacy: 'VITAMINA B12',
    categoriaLegacy: 'ENERGIA Y SISTEMA NERVIOSO',
    tipoProductoCodigo: 'TP-011',
    categoriasCodigos: ['CAT-006']
  },
  {
    nombreLegacy: 'VITAMINA E - HOORBACH',
    marca: 'Horbaach',
    nombreComercial: 'Vitamina E',
    presentacion: 'Cápsulas Blandas',
    dosaje: '450 mg',
    contenido: '200',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'VITAMINA E',
    categoriaLegacy: 'ANTIOXIDANTE Y METABOLISMO',
    tipoProductoCodigo: 'TP-061',
    categoriasCodigos: ['CAT-010']
  },
  {
    nombreLegacy: 'VITAMINA PARA EL CRECIMIENTO - NUBEST',
    marca: 'Nubest',
    nombreComercial: 'Vitamina para el Crecimiento +10 Años',
    presentacion: 'Cápsulas',
    dosaje: '-',
    contenido: '60',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'MULTIVITAMINICO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-046',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'WOMENS MULTIVITAMIN 220 - VITAFUSION',
    marca: 'Vitafusion',
    nombreComercial: 'Gomitas Multivitamínicas de Mujer',
    presentacion: 'Gomitas',
    dosaje: '-',
    contenido: '220',
    servingSize: '2.0',
    sabor: 'Bayas',
    subgrupoLegacy: 'MULTIVITAMINICO',
    categoriaLegacy: 'MULTIVITAMINICOS',
    tipoProductoCodigo: 'TP-046',
    categoriasCodigos: ['CAT-011']
  },
  {
    nombreLegacy: 'ZINC CARNOSINE - SWANSON',
    marca: 'Swanson',
    nombreComercial: 'Zinc Carnosine',
    presentacion: 'Cápsulas',
    dosaje: '8 mg',
    contenido: '60',
    servingSize: '1.0',
    sabor: 'Neutral',
    subgrupoLegacy: 'PEPZINGI',
    categoriaLegacy: 'SALUD DIGESTIVA',
    tipoProductoCodigo: 'TP-051',
    categoriasCodigos: ['CAT-002']
  },
  {
    nombreLegacy: 'ZINC IONICO ORGANICO LIQUIDO 4 A 13 AÑOS - MARY RUTH',
    marca: "Mary Ruth's",
    nombreComercial: 'Zinc Iónico Orgánico',
    presentacion: 'Gotero',
    dosaje: '3 mg',
    contenido: '2 oz',
    servingSize: '66',
    sabor: 'Bayas',
    subgrupoLegacy: 'SULFATO DE ZINC',
    categoriaLegacy: 'SISTEMA INMUNE',
    tipoProductoCodigo: 'TP-062',
    categoriasCodigos: ['CAT-001']
  }
];

// ============================================================================
// ETIQUETAS - Tags basados en certificaciones REALES verificadas por marca
// ============================================================================
// Fuentes verificadas:
// - Now Foods: https://www.nowfoods.com/quality-safety/seals-certifications
// - Nordic Naturals: https://www.nordic.com/nordic-promise/
// - Life Extension: https://www.lifeextension.com/faq/quality-purity-efficacy
// - Mary Ruth's: https://www.maryruthorganics.com/
// - Carlyle: https://carlylenutritionals.com/pages/manufacturing
// - Horbaach: https://horbaach.com/pages/our-standards
// - Doctor's Best: https://www.doctorsbest.com/
// - Natrol: https://www.natrol.com/
// - Microingredients: https://www.microingredients.com/pages/our-company

export interface EtiquetaConfig {
  codigo: string;
  nombre: string;
  tipo: 'certificacion' | 'calidad' | 'dieta' | 'publico' | 'presentacion';
  color: string;
  descripcion: string;
}

export const ETIQUETAS: EtiquetaConfig[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // CERTIFICACIONES VERIFICADAS
  // ══════════════════════════════════════════════════════════════════════════
  { codigo: 'ETQ-001', nombre: 'Non-GMO Project Verified', tipo: 'certificacion', color: '#F97316', descripcion: 'Certificado por Non-GMO Project - organismo independiente' },
  { codigo: 'ETQ-002', nombre: 'Non-GMO', tipo: 'certificacion', color: '#06B6D4', descripcion: 'Libre de organismos genéticamente modificados (sin certificación externa)' },
  { codigo: 'ETQ-003', nombre: 'USDA Organic', tipo: 'certificacion', color: '#22C55E', descripcion: 'Certificación orgánica USDA - mínimo 95% ingredientes orgánicos' },
  { codigo: 'ETQ-004', nombre: 'GMP Certified', tipo: 'certificacion', color: '#3B82F6', descripcion: 'Fabricado en instalaciones GMP certificadas' },
  { codigo: 'ETQ-005', nombre: 'NSF Certified', tipo: 'certificacion', color: '#8B5CF6', descripcion: 'Certificado por NSF International' },
  { codigo: 'ETQ-006', nombre: 'Friend of the Sea', tipo: 'certificacion', color: '#0EA5E9', descripcion: 'Pescado de fuentes sostenibles certificadas' },
  { codigo: 'ETQ-007', nombre: 'Third-Party Tested', tipo: 'certificacion', color: '#14B8A6', descripcion: 'Testeado por laboratorios independientes' },
  { codigo: 'ETQ-008', nombre: 'Kosher', tipo: 'certificacion', color: '#64748B', descripcion: 'Certificación Kosher' },
  { codigo: 'ETQ-009', nombre: 'B Corp Certified', tipo: 'certificacion', color: '#10B981', descripcion: 'Empresa B certificada - compromiso social y ambiental' },
  { codigo: 'ETQ-010', nombre: 'Clean Label Project', tipo: 'certificacion', color: '#84CC16', descripcion: 'Certificado por Clean Label Project - pureza verificada' },

  // ══════════════════════════════════════════════════════════════════════════
  // ATRIBUTOS DE DIETA (verificables en etiqueta del producto)
  // ══════════════════════════════════════════════════════════════════════════
  { codigo: 'ETQ-011', nombre: 'Vegano', tipo: 'dieta', color: '#22C55E', descripcion: 'Sin ingredientes de origen animal' },
  { codigo: 'ETQ-012', nombre: 'Vegetariano', tipo: 'dieta', color: '#84CC16', descripcion: 'Apto para vegetarianos (puede contener derivados animales)' },
  { codigo: 'ETQ-013', nombre: 'Sin Gluten', tipo: 'dieta', color: '#F59E0B', descripcion: 'Libre de gluten' },
  { codigo: 'ETQ-014', nombre: 'Sin Lácteos', tipo: 'dieta', color: '#3B82F6', descripcion: 'Libre de lácteos y derivados' },
  { codigo: 'ETQ-015', nombre: 'Sin Soya', tipo: 'dieta', color: '#8B5CF6', descripcion: 'Libre de soya' },
  { codigo: 'ETQ-016', nombre: 'Sin Azúcar', tipo: 'dieta', color: '#EF4444', descripcion: 'Sin azúcares añadidos' },
  { codigo: 'ETQ-017', nombre: 'Drug-Free', tipo: 'dieta', color: '#6366F1', descripcion: 'Libre de medicamentos - no adictivo' },

  // ══════════════════════════════════════════════════════════════════════════
  // PÚBLICO OBJETIVO
  // ══════════════════════════════════════════════════════════════════════════
  { codigo: 'ETQ-018', nombre: 'Para Niños', tipo: 'publico', color: '#EC4899', descripcion: 'Formulado específicamente para niños' },
  { codigo: 'ETQ-019', nombre: 'Para Adultos', tipo: 'publico', color: '#6366F1', descripcion: 'Formulado para adultos' },
  { codigo: 'ETQ-020', nombre: 'Para Mujeres', tipo: 'publico', color: '#F472B6', descripcion: 'Formulado específicamente para mujeres' },
  { codigo: 'ETQ-021', nombre: 'Para Hombres', tipo: 'publico', color: '#0891B2', descripcion: 'Formulado específicamente para hombres' },
  { codigo: 'ETQ-022', nombre: 'Para Mayores +50', tipo: 'publico', color: '#78716C', descripcion: 'Formulado para adultos mayores de 50 años' },
  { codigo: 'ETQ-023', nombre: 'Para Bebés', tipo: 'publico', color: '#FDA4AF', descripcion: 'Seguro para bebés' },
  { codigo: 'ETQ-024', nombre: 'Para Adolescentes', tipo: 'publico', color: '#A78BFA', descripcion: 'Formulado para adolescentes' },

  // ══════════════════════════════════════════════════════════════════════════
  // PRESENTACIÓN Y FACILIDAD DE USO
  // ══════════════════════════════════════════════════════════════════════════
  { codigo: 'ETQ-025', nombre: 'Sabor Agradable', tipo: 'presentacion', color: '#E11D48', descripcion: 'Sabor agradable, fácil de tomar' },
  { codigo: 'ETQ-026', nombre: 'Fácil de Tragar', tipo: 'presentacion', color: '#0D9488', descripcion: 'Cápsulas pequeñas o gomitas' },
  { codigo: 'ETQ-027', nombre: 'Presentación Líquida', tipo: 'presentacion', color: '#2563EB', descripcion: 'Formato líquido - absorción rápida' },
  { codigo: 'ETQ-028', nombre: 'Disolución Rápida', tipo: 'presentacion', color: '#7C3AED', descripcion: 'Se disuelve en la boca sin agua' },

  // ══════════════════════════════════════════════════════════════════════════
  // CALIDAD Y ORIGEN
  // ══════════════════════════════════════════════════════════════════════════
  { codigo: 'ETQ-029', nombre: 'Made in USA', tipo: 'calidad', color: '#1D4ED8', descripcion: 'Fabricado en Estados Unidos' },
  { codigo: 'ETQ-030', nombre: 'Marca Premium', tipo: 'calidad', color: '#B45309', descripcion: 'Marca de alta gama con estándares superiores' },
  { codigo: 'ETQ-031', nombre: 'Marca Valor', tipo: 'calidad', color: '#059669', descripcion: 'Excelente relación calidad-precio' },
  { codigo: 'ETQ-032', nombre: 'Science-Based', tipo: 'calidad', color: '#9333EA', descripcion: 'Fórmula basada en investigación científica' }
];

// ══════════════════════════════════════════════════════════════════════════════
// ETIQUETAS POR MARCA - Basadas en certificaciones REALES verificadas
// ══════════════════════════════════════════════════════════════════════════════

export const ETIQUETAS_POR_MARCA: Record<string, string[]> = {
  // NOW FOODS - Certificaciones verificadas:
  // Non-GMO Project Verified, GMP NPA A-rated, Kosher (algunos productos)
  // Fuente: https://www.nowfoods.com/quality-safety/seals-certifications
  'Now Foods': [
    'ETQ-001',  // Non-GMO Project Verified
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-012',  // Vegetariano (mayoría de productos)
    'ETQ-013',  // Sin Gluten
    'ETQ-029'   // Made in USA
  ],

  // NORDIC NATURALS - Certificaciones verificadas:
  // Friend of the Sea, Non-GMO (Eurofins), Third-Party Tested, NSF Certified for Sport
  // Fuente: https://www.nordic.com/nordic-promise/
  'Nordic Naturals': [
    'ETQ-002',  // Non-GMO (verificado por Eurofins)
    'ETQ-006',  // Friend of the Sea
    'ETQ-007',  // Third-Party Tested
    'ETQ-030',  // Marca Premium
    'ETQ-029'   // Made in USA
  ],

  // LIFE EXTENSION - Certificaciones verificadas:
  // NSF GMP Registered, Third-Party Tested (ConsumerLab), Non-GMO
  // Fuente: https://www.lifeextension.com/faq/quality-purity-efficacy
  'Life Extension': [
    'ETQ-002',  // Non-GMO
    'ETQ-004',  // GMP Certified
    'ETQ-005',  // NSF Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-012',  // Vegetariano (mayoría)
    'ETQ-030',  // Marca Premium
    'ETQ-032',  // Science-Based
    'ETQ-029'   // Made in USA
  ],

  // MARY RUTH'S - Certificaciones verificadas:
  // USDA Organic, B Corp, Clean Label Project, Vegan, Non-GMO, GMP
  // Fuente: https://www.maryruthorganics.com/
  "Mary Ruth's": [
    'ETQ-003',  // USDA Organic
    'ETQ-002',  // Non-GMO
    'ETQ-004',  // GMP Certified
    'ETQ-009',  // B Corp Certified
    'ETQ-010',  // Clean Label Project
    'ETQ-011',  // Vegano
    'ETQ-013',  // Sin Gluten
    'ETQ-014',  // Sin Lácteos
    'ETQ-015',  // Sin Soya
    'ETQ-030',  // Marca Premium
    'ETQ-029'   // Made in USA
  ],

  // CARLYLE - Certificaciones verificadas:
  // GMP Certified, Third-Party Tested, Non-GMO, Gluten-Free
  // Fuente: https://carlylenutritionals.com/pages/manufacturing
  'Carlyle': [
    'ETQ-002',  // Non-GMO
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-013',  // Sin Gluten
    'ETQ-031',  // Marca Valor
    'ETQ-029'   // Made in USA
  ],

  // HORBAACH - Certificaciones verificadas:
  // GMP Certified, FDA Audited, Lab Tested, Non-GMO, Gluten-Free
  // Fuente: https://horbaach.com/pages/our-standards
  'Horbaach': [
    'ETQ-002',  // Non-GMO
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-013',  // Sin Gluten
    'ETQ-031',  // Marca Valor
    'ETQ-029'   // Made in USA
  ],

  // DOCTOR'S BEST - Certificaciones verificadas:
  // Science-Based, Non-GMO, Vegetarian/Vegan options, Gluten-Free
  // Fuente: https://www.doctorsbest.com/
  "Doctor's Best": [
    'ETQ-002',  // Non-GMO
    'ETQ-007',  // Third-Party Tested
    'ETQ-012',  // Vegetariano
    'ETQ-013',  // Sin Gluten
    'ETQ-030',  // Marca Premium
    'ETQ-032',  // Science-Based
    'ETQ-029'   // Made in USA
  ],

  // NATROL - Certificaciones verificadas:
  // Drug-Free (#1 Sleep Aid), Non-GMO, Vegetarian, Gelatin-Free
  // Fuente: https://www.natrol.com/
  'Natrol': [
    'ETQ-002',  // Non-GMO
    'ETQ-012',  // Vegetariano
    'ETQ-017',  // Drug-Free
    'ETQ-016',  // Sin Azúcar (gummies)
    'ETQ-025',  // Sabor Agradable
    'ETQ-029'   // Made in USA
  ],

  // MICROINGREDIENTS - Certificaciones verificadas:
  // USDA Organic (algunos), Non-GMO, Third-Party Tested, Vegan-Friendly
  // Fuente: https://www.microingredients.com/pages/our-company
  'Microingredients': [
    'ETQ-002',  // Non-GMO
    'ETQ-007',  // Third-Party Tested
    'ETQ-011',  // Vegano (muchos productos)
    'ETQ-013',  // Sin Gluten
    'ETQ-015',  // Sin Soya
    'ETQ-031',  // Marca Valor
    'ETQ-029'   // Made in USA
  ],

  // KIRKLAND SIGNATURE (Costco) - Certificaciones:
  // USP Verified (algunos), GMP, Third-Party Tested
  'Kirkland Signature': [
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-031',  // Marca Valor (mejor precio)
    'ETQ-029'   // Made in USA
  ],

  // SPORTS RESEARCH - Certificaciones:
  // Non-GMO Project Verified, Third-Party Tested
  'Sports Research': [
    'ETQ-001',  // Non-GMO Project Verified
    'ETQ-007',  // Third-Party Tested
    'ETQ-030',  // Marca Premium
    'ETQ-029'   // Made in USA
  ],

  // CENTRUM - Marca farmacéutica:
  // GMP, USP Verified (algunos productos)
  'Centrum': [
    'ETQ-004',  // GMP Certified
    'ETQ-013',  // Sin Gluten
    'ETQ-029'   // Made in USA
  ],

  // PHYSICIAN'S CHOICE - Certificaciones:
  // Third-Party Tested, GMP
  "Physician's Choice": [
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-002',  // Non-GMO
    'ETQ-029'   // Made in USA
  ],

  // DOUBLE WOOD - Certificaciones:
  // Third-Party Tested, GMP
  'Double Wood': [
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-029'   // Made in USA
  ],

  // JOYSPRING - Marca infantil:
  // Organic, Vegan, Non-GMO
  'Joyspring': [
    'ETQ-002',  // Non-GMO
    'ETQ-011',  // Vegano
    'ETQ-018',  // Para Niños
    'ETQ-025',  // Sabor Agradable
    'ETQ-029'   // Made in USA
  ],

  // SOLARAY
  'Solaray': [
    'ETQ-004',  // GMP Certified
    'ETQ-012',  // Vegetariano
    'ETQ-029'   // Made in USA
  ],

  // YOUTHEORY
  'Youtheory': [
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-029'   // Made in USA
  ],

  // SWANSON
  'Swanson': [
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-031',  // Marca Valor
    'ETQ-029'   // Made in USA
  ],

  // VITAFUSION
  'Vitafusion': [
    'ETQ-004',  // GMP Certified
    'ETQ-013',  // Sin Gluten
    'ETQ-025',  // Sabor Agradable
    'ETQ-029'   // Made in USA
  ],

  // ALLIMAX
  'Allimax': [
    'ETQ-007',  // Third-Party Tested
    'ETQ-030',  // Marca Premium (patentado)
    'ETQ-032'   // Science-Based
  ],

  // COCO MARCH
  'Coco March': [
    'ETQ-027',  // Presentación Líquida
    'ETQ-029'   // Made in USA
  ],

  // ICY HOT (uso tópico)
  'Icy Hot': [
    'ETQ-029'   // Made in USA
  ],

  // NUBEST
  'Nubest': [
    'ETQ-004',  // GMP Certified
    'ETQ-018',  // Para Niños
    'ETQ-029'   // Made in USA
  ],

  // TRIQUETRA
  'Triquetra': [
    'ETQ-003',  // USDA Organic
    'ETQ-018',  // Para Niños
    'ETQ-029'   // Made in USA
  ],

  // PIPING ROCK
  'Piping Rock': [
    'ETQ-004',  // GMP Certified
    'ETQ-002',  // Non-GMO
    'ETQ-031',  // Marca Valor
    'ETQ-029'   // Made in USA
  ],

  // DR. MORITZ
  'Dr. Moritz': [
    'ETQ-018',  // Para Niños
    'ETQ-025',  // Sabor Agradable
    'ETQ-026',  // Fácil de Tragar (gomitas)
    'ETQ-029'   // Made in USA
  ],

  // LIL CRITTER'S
  "Lil Critter's": [
    'ETQ-018',  // Para Niños
    'ETQ-025',  // Sabor Agradable
    'ETQ-026',  // Fácil de Tragar (gomitas)
    'ETQ-029'   // Made in USA
  ],

  // WELLNESS LABS RX
  'Wellness Labs Rx': [
    'ETQ-004',  // GMP Certified
    'ETQ-012',  // Vegetariano
    'ETQ-032',  // Science-Based
    'ETQ-029'   // Made in USA
  ],

  // NATURE'S TRUTH
  "Nature's Truth": [
    'ETQ-004',  // GMP Certified
    'ETQ-007',  // Third-Party Tested
    'ETQ-002',  // Non-GMO
    'ETQ-031',  // Marca Valor
    'ETQ-029'   // Made in USA
  ]
};

// ══════════════════════════════════════════════════════════════════════════════
// ETIQUETAS ADICIONALES POR PRESENTACIÓN
// ══════════════════════════════════════════════════════════════════════════════

export const ETIQUETAS_POR_PRESENTACION: Record<string, string[]> = {
  'Gomitas': ['ETQ-025', 'ETQ-026'],
  'Líquido': ['ETQ-027'],
  'Gotero': ['ETQ-027'],
  'Mini Cápsulas Blandas': ['ETQ-026'],
  'Tableta de Disolución Rápida': ['ETQ-028']
};

// ══════════════════════════════════════════════════════════════════════════════
// ETIQUETAS POR PÚBLICO (detectadas del nombre del producto)
// ══════════════════════════════════════════════════════════════════════════════

export const ETIQUETAS_POR_PUBLICO: Record<string, string> = {
  'niño': 'ETQ-018',
  'niños': 'ETQ-018',
  'kids': 'ETQ-018',
  'children': 'ETQ-018',
  'junior': 'ETQ-018',
  'baby': 'ETQ-023',
  'bebé': 'ETQ-023',
  'bebés': 'ETQ-023',
  'mujer': 'ETQ-020',
  'mujeres': 'ETQ-020',
  'women': 'ETQ-020',
  "woman's": 'ETQ-020',
  'hombre': 'ETQ-021',
  'hombres': 'ETQ-021',
  'men': 'ETQ-021',
  "man's": 'ETQ-021',
  'mens': 'ETQ-021',
  'teen': 'ETQ-024',
  'adolescente': 'ETQ-024',
  '+50': 'ETQ-022',
  '50+': 'ETQ-022',
  'adult': 'ETQ-019',
  'adulto': 'ETQ-019',
  'adultos': 'ETQ-019'
};

// Mantener compatibilidad con código anterior
export const ETIQUETAS_SUGERIDAS = ETIQUETAS_POR_MARCA;

// ============================================================================
// RESUMEN DE CORRECCIONES APLICADAS
// ============================================================================

export const CORRECCIONES_APLICADAS = {
  erroresTipograficos: [
    { original: 'MANEJO DEL ESTRES Y ENERGIIA', corregido: 'Energía y Vitalidad + Manejo del Estrés' },
    { original: 'ASTANXATINA', corregido: 'Astaxantina' },
    { original: 'GINGKO BILOBA', corregido: 'Ginkgo Biloba' }
  ],
  categoriasConsolidadas: [
    { original: 'SALUD CARDIOVASCULAR Y CEREBRAL', separadas: ['Salud Cardiovascular', 'Salud Cerebral'] },
    { original: 'SALUD OSEA Y CARDIOVASCULAR', separadas: ['Salud Ósea', 'Salud Cardiovascular'] },
    { original: 'SALUD OSEA E INMUNE', separadas: ['Salud Ósea', 'Sistema Inmune'] },
    { original: 'SALUD OSEA / HORMONAL', separadas: ['Salud Ósea', 'Salud Hormonal'] },
    { original: 'PIEL, ARTICULACIONES Y HUESOS', separadas: ['Piel y Articulaciones', 'Salud Ósea'] }
  ],
  categoriasRenombradas: [
    { original: 'ENERGIA Y SISTEMA NERVIOSO', nuevo: 'Energía y Vitalidad' },
    { original: 'SUEÑO Y RELAJACION', nuevo: 'Sueño y Relajación' },
    { original: 'METABOLISMO Y AZUCAR EN SANGRE', nuevo: 'Antioxidantes y Metabolismo' }
  ],
  formatoTitleCase: {
    marcas: 'Aplicado a todas las marcas (ej: NOW FOODS → Now Foods)',
    presentaciones: 'Aplicado a todas las presentaciones (ej: CAPSULAS VEGETALES → Cápsulas Vegetales)',
    sabores: 'Aplicado a todos los sabores (ej: NEUTRAL → Neutral)',
    nombresComerciales: 'Aplicado a todos los nombres comerciales'
  },
  totalProductos: 132,
  totalCategorias: 16,
  totalTiposProducto: 62,
  productosConMultiplesCategorias: 47
};
