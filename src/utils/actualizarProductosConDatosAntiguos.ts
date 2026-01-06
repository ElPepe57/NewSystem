/**
 * Utilidad para actualizar productos existentes con datos del sistema antiguo
 * Actualiza: stockMinimo, stockMaximo, precioSugerido, y genera SKU si falta
 */

import { ProductoService } from '../services/producto.service';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Datos del archivo MD del sistema antiguo con MINIMO, MAXIMO y PRECIO
interface ProductoSistemaAntiguo {
  marca: string;
  nombreComercial: string;
  presentacion: string;
  dosaje: string;
  contenido: string;
  servingSize: string;
  sabor: string;
  grupo: string;
  subgrupo: string;
  minimo: number;
  maximo: number;
  precio: number;
}

// Datos parseados del archivo MD actualizado
const productosSistemaAntiguo: ProductoSistemaAntiguo[] = [
  { marca: "NOW FOODS", nombreComercial: "5-HTP", presentacion: "CAPSULAS VEGETALES", dosaje: "100 mg", contenido: "120", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "5-HTP", minimo: 0, maximo: 0, precio: 120 },
  { marca: "HORBAACH", nombreComercial: "5-MTHF", presentacion: "CAPSULAS", dosaje: "1000 mcg", contenido: "200", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD CELULAR", subgrupo: "5-MTHF", minimo: 0, maximo: 1, precio: 140 },
  { marca: "PHYSICIAN'S CHOICE", nombreComercial: "60 BILLION PROBIOTIC", presentacion: "CAPSULAS", dosaje: "-", contenido: "30", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PROBIOTICOS + PREBIOTICOS", minimo: 0, maximo: 0, precio: 175 },
  { marca: "CARLYLE", nombreComercial: "ACEITE DE OREGANO", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "4000 mg", contenido: "150", servingSize: "2.0", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO", minimo: 4, maximo: 12, precio: 110 },
  { marca: "CARLYLE", nombreComercial: "ACEITE DE OREGANO", presentacion: "GOTERO", dosaje: "34 mg", contenido: "2 oz", servingSize: "26", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO", minimo: 0, maximo: 0, precio: 100 },
  { marca: "MICROINGREDIENTS", nombreComercial: "ACEITE DE OREGANO", presentacion: "CAPSULAS BLANDAS", dosaje: "6000 mg", contenido: "300", servingSize: "2.0", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO", minimo: 1, maximo: 4, precio: 210 },
  { marca: "PIPPING ROCK", nombreComercial: "ACEITE DE OREGANO", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "4000 mg", contenido: "200", servingSize: "2.0", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO", minimo: 0, maximo: 0, precio: 100 },
  { marca: "SPORTS RESEARCH", nombreComercial: "ALASKA OMEGA 3", presentacion: "CAPSULAS BLANDAS", dosaje: "1040 mg", contenido: "90", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 4, maximo: 8, precio: 205 },
  { marca: "ALLIMAX", nombreComercial: "ALLISURE POWDER", presentacion: "CAPSULAS VEGETALES", dosaje: "180 mg", contenido: "30", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "ALLISURE POWDER", minimo: 0, maximo: 0, precio: 175 },
  { marca: "MICROINGREDIENTS", nombreComercial: "ALPHA LIPOIC ACID", presentacion: "CAPSULAS BLANDAS", dosaje: "600 mg", contenido: "120", servingSize: "3.0", sabor: "COCO", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "ALPHA LIPOIC ACID", minimo: 0, maximo: 0, precio: 205 },
  { marca: "CARLYLE", nombreComercial: "ANTARTIC KRILL OIL", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "2000 mg + 600 mcg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "KRILL OIL", minimo: 2, maximo: 4, precio: 145 },
  { marca: "NORDIC NATURALS", nombreComercial: "ARTIC-D", presentacion: "LIQUIDO", dosaje: "1000 UI + 1060 mg", contenido: "8 oz", servingSize: "0.17", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "D3 + OMEGA 3", minimo: 4, maximo: 12, precio: 200 },
  { marca: "CARLYLE", nombreComercial: "ASHWAGHANDA", presentacion: "CAPSULAS BLANDAS", dosaje: "3000 mg", contenido: "300", servingSize: "2.0", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "ASHWAGHANDA", minimo: 2, maximo: 6, precio: 170 },
  { marca: "HORBAACH", nombreComercial: "ASHWAGHANDA", presentacion: "CAPSULAS", dosaje: "450 mg", contenido: "120", servingSize: "4.0", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "ASHWAGHANDA", minimo: 0, maximo: 1, precio: 69 },
  { marca: "NOW FOODS", nombreComercial: "ASHWAGHANDA", presentacion: "CAPSULAS VEGETALES", dosaje: "450 mg", contenido: "90", servingSize: "1.0", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "ASHWAGHANDA", minimo: 0, maximo: 2, precio: 120 },
  { marca: "MICROINGREDIENTS", nombreComercial: "ASTAXANTINA", presentacion: "CAPSULAS BLANDAS", dosaje: "12 mg", contenido: "120", servingSize: "1.0", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "ASTANXATINA", minimo: 0, maximo: 1, precio: 225 },
  { marca: "CARLYLE", nombreComercial: "BERBERINA", presentacion: "CAPSULAS VEGETALES", dosaje: "500000 mcg", contenido: "60", servingSize: "2.0", sabor: "NEUTRAL", grupo: "METABOLISMO Y AZUCAR EN SANGRE", subgrupo: "BERBERINA", minimo: 6, maximo: 24, precio: 120 },
  { marca: "HORBAACH", nombreComercial: "BERBERINA", presentacion: "CAPSULAS VEGETALES", dosaje: "2000 mg", contenido: "120", servingSize: "1.0", sabor: "CANELA", grupo: "METABOLISMO Y AZUCAR EN SANGRE", subgrupo: "BERBERINA", minimo: 0, maximo: 0, precio: 150 },
  { marca: "NOW FOODS", nombreComercial: "BORO", presentacion: "CAPSULAS VEGETALES", dosaje: "3 mg", contenido: "250", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD OSEA / HORMONAL", subgrupo: "BORO", minimo: 0, maximo: 2, precio: 100 },
  { marca: "KIRKLAND SIGNATURE", nombreComercial: "CALCIUM, D3 Y ZINC", presentacion: "GOMITAS", dosaje: "-", contenido: "120", servingSize: "2.0", sabor: "FRUTAS TROPICALES", grupo: "SALUD OSEA", subgrupo: "D3 + CALCIUM + ZINC", minimo: 0, maximo: 0, precio: 90 },
  { marca: "MICROINGREDIENTS", nombreComercial: "CAPSULAS DE ACEITE DE SEMILLA DE CALABAZA", presentacion: "CAPSULAS BLANDAS", dosaje: "3000 mg", contenido: "300", servingSize: "3.0", sabor: "CALABAZA", grupo: "SALUD HORMONAL", subgrupo: "ACEITE DE SEMILLA DE CALABAZA", minimo: 1, maximo: 2, precio: 180 },
  { marca: "MICROINGREDIENTS", nombreComercial: "CAPSULAS DE PEPTIDOS DE COLAGENO", presentacion: "CAPSULAS", dosaje: "1100 mg", contenido: "240", servingSize: "3.0", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "COLAGENO", minimo: 2, maximo: 4, precio: 200 },
  { marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE ADULTO", presentacion: "CAPSULAS", dosaje: "-", contenido: "200", servingSize: "1.0", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO", minimo: 0, maximo: 0, precio: 160 },
  { marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE HOMBRE", presentacion: "CAPSULAS", dosaje: "-", contenido: "200", servingSize: "2.0", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO", minimo: 0, maximo: 0, precio: 170 },
  { marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE MUJER", presentacion: "CAPSULAS", dosaje: "-", contenido: "275", servingSize: "1.0", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA MUJER", minimo: 0, maximo: 0, precio: 170 },
  { marca: "HORBAACH", nombreComercial: "CARDO MARIANO", presentacion: "CAPSULAS", dosaje: "3000 mg", contenido: "300", servingSize: "3.0", sabor: "NEUTRAL", grupo: "SALUD HEPATICA", subgrupo: "CARDO MARIANO", minimo: 0, maximo: 0, precio: 140 },
  { marca: "CARLYLE", nombreComercial: "CITICOLINE CDP", presentacion: "CAPSULAS", dosaje: "1000 mg", contenido: "60", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "CITICOLINE CDP", minimo: 0, maximo: 0, precio: 150 },
  { marca: "DR. MORITZ", nombreComercial: "CITRATO DE MAGNESIO", presentacion: "GOMITAS", dosaje: "100 mg", contenido: "60", servingSize: "2.0", sabor: "FRAMBUESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "CITRATO DE MAGNESIO", minimo: 2, maximo: 6, precio: 110 },
  { marca: "YOUTHEORY", nombreComercial: "COLLAGEN + BIOTIN", presentacion: "TABLETAS", dosaje: "6000 mg + 3000 mcg", contenido: "390", servingSize: "6.0", sabor: "NEUTRAL", grupo: "PIEL, ARTICULACIONES Y HUESOS", subgrupo: "COLAGENO", minimo: 2, maximo: 4, precio: 190 },
  { marca: "LIFE EXTENSION", nombreComercial: "COMPLEJO B", presentacion: "CAPSULAS VEGETALES", dosaje: "-", contenido: "60", servingSize: "2.0", sabor: "NEUTRAL", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "COMPLEJO B", minimo: 0, maximo: 2, precio: 90 },
  { marca: "MICROINGREDIENTS", nombreComercial: "COMPLEJO B", presentacion: "CAPSULAS", dosaje: "-", contenido: "240", servingSize: "2.0", sabor: "NEUTRAL", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "COMPLEJO B", minimo: 2, maximo: 6, precio: 190 },
  { marca: "NORDIC NATURALS", nombreComercial: "COMPLETE OMEGA JUNIOR", presentacion: "MINI CAPSULAS BLANDAS", dosaje: "283 mg + 35 mg", contenido: "180", servingSize: "2.0", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3 + GLA", minimo: 0, maximo: 2, precio: 190 },
  { marca: "MICROINGREDIENTS", nombreComercial: "COQ 10", presentacion: "CAPSULAS BLANDAS", dosaje: "100 mg", contenido: "240", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "COQ 10", minimo: 0, maximo: 1, precio: 170 },
  { marca: "LIFE EXTENSION", nombreComercial: "COQ 10", presentacion: "CAPSULAS BLANDAS", dosaje: "100 mg", contenido: "60", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "COQ 10", minimo: 2, maximo: 4, precio: 230 },
  { marca: "CARLYLE", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "10000 IU + 200 mcg", contenido: "300", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2", minimo: 6, maximo: 24, precio: 140 },
  { marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "5000 IU + 100 mcg", contenido: "300", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2", minimo: 1, maximo: 2, precio: 160 },
  { marca: "NOW FOODS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS", dosaje: "1000 IU + 45 mcg", contenido: "120", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2", minimo: 1, maximo: 2, precio: 90 },
  { marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "10000 IU + 200 mcg", contenido: "300", servingSize: "1.0", sabor: "COCO", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2", minimo: 1, maximo: 2, precio: 170 },
  { marca: "JOYSPRING", nombreComercial: "DETOXZEE", presentacion: "GOTERO", dosaje: "200 IU + 300 mcg", contenido: "1 oz", servingSize: "33", sabor: "BAYAS", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "D + B12", minimo: 0, maximo: 1, precio: 220 },
  { marca: "NORDIC NATURALS", nombreComercial: "DHA PARA BEBES", presentacion: "LIQUIDO", dosaje: "300 IU + 1050 mg", contenido: "2 oz", servingSize: "42", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "D3 + OMEGA 3", minimo: 1, maximo: 3, precio: 130 },
  { marca: "NORDIC NATURALS", nombreComercial: "DHA XTRA", presentacion: "LIQUIDO", dosaje: "880 mg", contenido: "2 oz", servingSize: "42", sabor: "BAYAS", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 4, maximo: 8, precio: 170 },
  { marca: "COCO MARCH", nombreComercial: "DIGESTIVE DROPS", presentacion: "GOTERO", dosaje: "200 mg", contenido: "1 oz", servingSize: "14", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "EXTRACTO HUMICO MOLECULAR", minimo: 0, maximo: 0, precio: 200 },
  { marca: "PHYSICIAN'S CHOICE", nombreComercial: "ENZIMAS DIGESTIVAS", presentacion: "CAPSULAS", dosaje: "-", contenido: "60", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "ENZIMAS DIGESTIVAS", minimo: 0, maximo: 0, precio: 170 },
  { marca: "MICROINGREDIENTS", nombreComercial: "ESPIRULINA DE CHLORELLA", presentacion: "PASTILLAS", dosaje: "3000 mg", contenido: "720", servingSize: "6.0", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "SPIRULINA", minimo: 0, maximo: 2, precio: 220 },
  { marca: "TRIQUETRA", nombreComercial: "FOLATO DE METILO ORGANICO PARA NIÑOS", presentacion: "GOTERO", dosaje: "1 oz", contenido: "1 oz", servingSize: "0.04", sabor: "BAYAS", grupo: "SALUD CELULAR", subgrupo: "5-MTHF", minimo: 0, maximo: 1, precio: 180 },
  { marca: "LIFE EXTENSION", nombreComercial: "FOLATO OPTIMIZADO", presentacion: "CAPSULAS VEGETALES", dosaje: "1700 mcg", contenido: "100", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD CELULAR", subgrupo: "5-MTHF", minimo: 0, maximo: 2, precio: 110 },
  { marca: "MICROINGREDIENTS", nombreComercial: "GINKGO BILOBA", presentacion: "CAPSULAS BLANDAS", dosaje: "120 mg", contenido: "400", servingSize: "2.0", sabor: "COCO", grupo: "SALUD COGNITIVA", subgrupo: "GINGKO BILOBA", minimo: 0, maximo: 1, precio: 170 },
  { marca: "MICROINGREDIENTS", nombreComercial: "GLUCOSAMINA CONDROITINA", presentacion: "TABLETA BISECTADA", dosaje: "4000 mg", contenido: "300", servingSize: "3.0", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "GLUCOSAMINA CONDROITINA", minimo: 0, maximo: 2, precio: 170 },
  { marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA ADULTOS", presentacion: "GOMITAS", dosaje: "10 mg", contenido: "190", servingSize: "2.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 4, maximo: 8, precio: 170 },
  { marca: "CARLYLE", nombreComercial: "GOMITAS DE MELATONINA PARA ADULTOS", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "12 mg", contenido: "300", servingSize: "1.0", sabor: "BAYAS", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 2, maximo: 6, precio: 110 },
  { marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "1 mg", contenido: "140", servingSize: "1.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 4, maximo: 8, precio: 150 },
  { marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "1 mg", contenido: "90", servingSize: "1.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 2, maximo: 4, precio: 105 },
  { marca: "CENTRUM", nombreComercial: "GOMITAS MULTIVITAMINICAS DE HOMBRE", presentacion: "GOMITAS", dosaje: "-", contenido: "170", servingSize: "2.0", sabor: "FRUTAS TROPICALES", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA HOMBRE", minimo: 0, maximo: 0, precio: 170 },
  { marca: "CENTRUM", nombreComercial: "GOMITAS MULTIVITAMINICAS DE MUJER", presentacion: "GOMITAS", dosaje: "-", contenido: "170", servingSize: "2.0", sabor: "FRUTAS TROPICALES", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA MUJER", minimo: 0, maximo: 0, precio: 160 },
  { marca: "VITAFUSION", nombreComercial: "GOMITAS MULTIVITAMINICAS DE MUJER", presentacion: "GOMITAS", dosaje: "-", contenido: "220", servingSize: "2.0", sabor: "BAYAS", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO", minimo: 0, maximo: 0, precio: 150 },
  { marca: "KIRKLAND SIGNATURE", nombreComercial: "GOMITAS MULTIVITAMINICAS DE NIÑO", presentacion: "GOMITAS", dosaje: "-", contenido: "160", servingSize: "2.0", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO", minimo: 0, maximo: 0, precio: 85 },
  { marca: "LIL CRITTER'S", nombreComercial: "GOMITAS MULTIVITAMINICAS DE NIÑO", presentacion: "GOMITAS", dosaje: "-", contenido: "300", servingSize: "2.0", sabor: "FRUTAS TROPICALES", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO", minimo: 2, maximo: 4, precio: 130 },
  { marca: "JOYSPRING", nombreComercial: "GOTAS GENIUS", presentacion: "GOTERO", dosaje: "-", contenido: "1 oz", servingSize: "33", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "GINGKO BILOBA", minimo: 0, maximo: 1, precio: 220 },
  { marca: "ICY HOT", nombreComercial: "ICY HOT", presentacion: "ROLL ON", dosaje: "-", contenido: "2.5 oz", servingSize: "28", sabor: "MENTOL", grupo: "USO TOPICO", subgrupo: "ICY HOT", minimo: 0, maximo: 0, precio: 80 },
  { marca: "ICY HOT", nombreComercial: "ICY HOT", presentacion: "SPRAY", dosaje: "-", contenido: "4 oz", servingSize: "44", sabor: "MENTOL", grupo: "USO TOPICO", subgrupo: "ICY HOT", minimo: 0, maximo: 0, precio: 80 },
  { marca: "CARLYLE", nombreComercial: "KRILL OIL", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "2000 mg + 600 mcg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3 + ASTAXANTINA", minimo: 1, maximo: 2, precio: 145 },
  { marca: "MICROINGREDIENTS", nombreComercial: "KRILL OIL", presentacion: "CAPSULAS BLANDAS", dosaje: "2000 mg + 800 mcg", contenido: "240", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3 + ASTAXANTINA", minimo: 1, maximo: 2, precio: 230 },
  { marca: "NOW FOODS", nombreComercial: "KSM 66 + ASHWAGHANDA", presentacion: "CAPSULAS VEGETALES", dosaje: "600 mg", contenido: "90", servingSize: "2.0", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "KSM 66 + ASHWAGHANDA", minimo: 1, maximo: 2, precio: 165 },
  { marca: "NOW FOODS", nombreComercial: "L-TEANINA", presentacion: "CAPSULAS VEGETALES", dosaje: "100 mg", contenido: "90", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "L-TEANINA", minimo: 0, maximo: 1, precio: 110 },
  { marca: "JOYSPRING", nombreComercial: "LINGO LEAP", presentacion: "GOTERO", dosaje: "-", contenido: "1 oz", servingSize: "33", sabor: "FRAMBUESAS", grupo: "SALUD COGNITIVA", subgrupo: "EXTRACTO HERBAL", minimo: 2, maximo: 6, precio: 210 },
  { marca: "MARY RUTH'S", nombreComercial: "LIQUIDO MULTIVITAMINICO", presentacion: "LIQUIDO", dosaje: "-", contenido: "15.22 oz", servingSize: "1.014", sabor: "FRAMBUESA", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO", minimo: 2, maximo: 4, precio: 240 },
  { marca: "MARY RUTH'S", nombreComercial: "LIQUIDO MULTIVITAMINICO + CRECIMIENTO DEL CABELLO", presentacion: "LIQUIDO", dosaje: "-", contenido: "15.22 oz", servingSize: "1.014", sabor: "MANGO", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO", minimo: 2, maximo: 4, precio: 350 },
  { marca: "CARLYLE", nombreComercial: "LUTEINA", presentacion: "CAPSULAS BLANDAS", dosaje: "40 mg", contenido: "180", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD VISUAL", subgrupo: "LUTEINA", minimo: 1, maximo: 2, precio: 160 },
  { marca: "CARLYLE", nombreComercial: "MAGNESIO + ASHWAGHANDA", presentacion: "CAPSULAS BLANDAS", dosaje: "150 mg + 1500 mg", contenido: "120", servingSize: "3.0", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "MAGNESIO + ASHWAGHANDA", minimo: 0, maximo: 2, precio: 110 },
  { marca: "CARLYLE", nombreComercial: "MAGNESIO BISGLICINATO", presentacion: "CAPSULAS", dosaje: "665 mg", contenido: "250", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "BISGLICINATO DE MAGNESIO", minimo: 2, maximo: 6, precio: 170 },
  { marca: "DOCTOR'S BEST", nombreComercial: "MAGNESIO GLICINATO", presentacion: "TABLETAS", dosaje: "200 mg", contenido: "240", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO", minimo: 0, maximo: 0, precio: 170 },
  { marca: "DOUBLE WOOD", nombreComercial: "MAGNESIO GLICINATO", presentacion: "CAPSULAS VEGETALES", dosaje: "400 mg", contenido: "180", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO", minimo: 2, maximo: 6, precio: 165 },
  { marca: "HORBAACH", nombreComercial: "MAGNESIO GLICINATO", presentacion: "CAPSULAS", dosaje: "1330 mg", contenido: "250", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO", minimo: 0, maximo: 1, precio: 140 },
  { marca: "SOLARAY", nombreComercial: "MAGNESIO GLICINATO", presentacion: "CAPSULAS VEGETALES", dosaje: "350 mg", contenido: "120", servingSize: "4.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO", minimo: 1, maximo: 2, precio: 260 },
  { marca: "DR. MORITZ", nombreComercial: "MAGNESIO PARA NIÑOS", presentacion: "GOMITAS", dosaje: "100 mg", contenido: "60", servingSize: "2.0", sabor: "FRAMBUESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "CITRATO DE MAGNESIO", minimo: 2, maximo: 6, precio: 110 },
  { marca: "LIFE EXTENSION", nombreComercial: "MAGTEIN", presentacion: "CAPSULAS VEGETALES", dosaje: "144 mg", contenido: "90", servingSize: "3.0", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MAGNESIO L-TREONATO", minimo: 0, maximo: 2, precio: 210 },
  { marca: "DOUBLE WOOD", nombreComercial: "MAGTEIN", presentacion: "CAPSULAS", dosaje: "2000 mg", contenido: "120", servingSize: "4.0", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MAGNESIO L-TREONATO", minimo: 0, maximo: 1, precio: 175 },
  { marca: "NATROL", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5 mg", contenido: "200", servingSize: "1.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 1, maximo: 4, precio: 125 },
  { marca: "MICROINGREDIENTS", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "20 mg", contenido: "400", servingSize: "1.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 2, maximo: 6, precio: 165 },
  { marca: "NATROL", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5 mg", contenido: "250", servingSize: "1.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 2, maximo: 6, precio: 160 },
  { marca: "CARLYLE", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "40 mg", contenido: "150", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 2, maximo: 6, precio: 105 },
  { marca: "CARLYLE", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5 mg", contenido: "300", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA", minimo: 2, maximo: 6, precio: 95 },
  { marca: "NATROL", nombreComercial: "MELATONINA +  L-TEANINA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "1 mg + 25 mg", contenido: "60", servingSize: "2.0", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA + L-TEANINA", minimo: 0, maximo: 0, precio: 100 },
  { marca: "CARLYLE", nombreComercial: "MELENA DE LEON", presentacion: "GOTERO", dosaje: "2 ml", contenido: "2 oz", servingSize: "66", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MELENA DE LEON", minimo: 0, maximo: 0, precio: 95 },
  { marca: "HORBAACH", nombreComercial: "MELENA DE LEON", presentacion: "CAPSULAS VEGETALES", dosaje: "4200 mg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MELENA DE LEON", minimo: 4, maximo: 8, precio: 140 },
  { marca: "SPORTS RESEARCH", nombreComercial: "MULTI COLAGENO", presentacion: "CAPSULAS", dosaje: "1600 mg", contenido: "90", servingSize: "3.0", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "COLAGENO", minimo: 0, maximo: 1, precio: 180 },
  { marca: "KIRKLAND SIGNATURE", nombreComercial: "MULTIVITAMINICO PARA ADULTOS", presentacion: "GOMITAS", dosaje: "-", contenido: "160", servingSize: "2.0", sabor: "FRESA Y BAYAS", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA ADULTOS", minimo: 0, maximo: 0, precio: 85 },
  { marca: "CARLYLE", nombreComercial: "MYO INOSITOL", presentacion: "CAPSULAS", dosaje: "2060 mg", contenido: "150", servingSize: "4.0", sabor: "NEUTRAL", grupo: "SALUD HORMONAL", subgrupo: "MYO INOSITOL", minimo: 1, maximo: 2, precio: 140 },
  { marca: "LIFE EXTENSION", nombreComercial: "NAD + RESVERATROL", presentacion: "CAPSULAS VEGETALES", dosaje: "55 mg + 300 mg", contenido: "30", servingSize: "1.0", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "RESVERATROL + NAD", minimo: 1, maximo: 4, precio: 210 },
  { marca: "WELLNESS LABS RX", nombreComercial: "NAD + RESVERATROL", presentacion: "CAPSULAS VEGETALES", dosaje: "300 mg + 1200 mg", contenido: "90", servingSize: "2.0", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "RESVERATROL + NAD", minimo: 4, maximo: 8, precio: 170 },
  { marca: "LIFE EXTENSION", nombreComercial: "NAD+", presentacion: "CAPSULAS VEGETALES", dosaje: "100 mg", contenido: "30", servingSize: "1.0", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "NAD", minimo: 1, maximo: 2, precio: 110 },
  { marca: "LIFE EXTENSION", nombreComercial: "NEUROMAG", presentacion: "CAPSULAS VEGETALES", dosaje: "144 mg", contenido: "90", servingSize: "3.0", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MAGNESIO L-TREONATO", minimo: 1, maximo: 4, precio: 210 },
  { marca: "MICROINGREDIENTS", nombreComercial: "OMEGA 3", presentacion: "CAPSULAS BLANDAS", dosaje: "4200 mg", contenido: "240", servingSize: "3.0", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 4, maximo: 8, precio: 220 },
  { marca: "NORDIC NATURALS", nombreComercial: "OMEGA 3", presentacion: "LIQUIDO", dosaje: "1560 mg", contenido: "8 oz", servingSize: "0.17", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 2, maximo: 6, precio: 190 },
  { marca: "NOW FOODS", nombreComercial: "OMEGA 369", presentacion: "CAPSULAS BLANDAS", dosaje: "1400 mg", contenido: "250", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 1, maximo: 2, precio: 140 },
  { marca: "DOCTOR'S BEST", nombreComercial: "PEPZIN GI", presentacion: "CAPSULAS VEGETALES", dosaje: "75 mg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PEPZINGI", minimo: 0, maximo: 0, precio: 190 },
  { marca: "MICROINGREDIENTS", nombreComercial: "POLVO DE PEPTIDOS DE COLAGENO", presentacion: "POLVO", dosaje: "10888 mg", contenido: "1 lb", servingSize: "24", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "COLAGENO", minimo: 2, maximo: 4, precio: 210 },
  { marca: "CARLYLE", nombreComercial: "PREBIOTICOS + PROBIOTICOS 50 BILLION", presentacion: "CAPSULAS VEGETALES", dosaje: "142 mg + 200 mg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PROBIOTICOS + PREBIOTICOS", minimo: 0, maximo: 1, precio: 140 },
  { marca: "NOW FOODS", nombreComercial: "REFUERZO DE CANDIDA", presentacion: "CAPSULAS VEGETALES", dosaje: "-", contenido: "180", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "REFUERZO DE CANDIDA", minimo: 1, maximo: 2, precio: 170 },
  { marca: "CARLYLE", nombreComercial: "RESVERATROL", presentacion: "CAPSULAS DE LIBERACION RAPIDA", dosaje: "1800 mg", contenido: "180", servingSize: "3.0", sabor: "UVA", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "RESVERATROL", minimo: 2, maximo: 12, precio: 110 },
  { marca: "CARLYLE", nombreComercial: "SELENIO", presentacion: "CAPSULAS VEGETALES", dosaje: "200 mcg", contenido: "200", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "SELENIO", minimo: 1, maximo: 2, precio: 110 },
  { marca: "CARLYLE", nombreComercial: "SHILAJIT", presentacion: "CAPSULAS DE LIBERACION RAPIDA", dosaje: "2000 mg", contenido: "90", servingSize: "1.0", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "SHILAJIT", minimo: 0, maximo: 0, precio: 105 },
  { marca: "NOW FOODS", nombreComercial: "SUPER ENZIMAS", presentacion: "CAPSULAS", dosaje: "-", contenido: "180", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "ENZIMAS DIGESTIVAS", minimo: 4, maximo: 8, precio: 170 },
  { marca: "LIFE EXTENSION", nombreComercial: "SUPER OMEGA 3 PLUS", presentacion: "CAPSULAS BLANDAS", dosaje: "2350 mg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 2, maximo: 4, precio: 205 },
  { marca: "HORBAACH", nombreComercial: "TONGKAT ALI", presentacion: "CAPSULAS DE LIBERACION RAPIDA", dosaje: "1600 mg", contenido: "120", servingSize: "2.0", sabor: "NEUTRAL", grupo: "SALUD HORMONAL", subgrupo: "LONGJACK", minimo: 0, maximo: 0, precio: 90 },
  { marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA", presentacion: "LIQUIDO", dosaje: "2840 mg", contenido: "4 oz", servingSize: "0.17", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 1, maximo: 2, precio: 220 },
  { marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA KIDS", presentacion: "MINI CAPSULAS BLANDAS", dosaje: "680 mg", contenido: "90", servingSize: "2.0", sabor: "FRESA", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 2, maximo: 4, precio: 230 },
  { marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA TEEN", presentacion: "MINI CAPSULAS BLANDAS", dosaje: "1120 mg", contenido: "60", servingSize: "2.0", sabor: "FRESA", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 2, maximo: 4, precio: 230 },
  { marca: "NOW FOODS", nombreComercial: "ULTRA OMEGA 3 - CARDIOVASCULAR", presentacion: "CAPSULAS BLANDAS", dosaje: "750 mg", contenido: "180", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 0, maximo: 2, precio: 200 },
  { marca: "NOW FOODS", nombreComercial: "ULTRA OMEGA 3 - CEREBRO Y CORAZON", presentacion: "CAPSULAS BLANDAS", dosaje: "750 mg", contenido: "180", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 0, maximo: 2, precio: 200 },
  { marca: "NATURE'S TRUTH", nombreComercial: "VINAGRE DE MANZANA", presentacion: "CAPSULAS", dosaje: "1200 mg", contenido: "60", servingSize: "2.0", sabor: "MANZANA", grupo: "SALUD DIGESTIVA", subgrupo: "VINAGRE DE MANZANA", minimo: 0, maximo: 0, precio: 90 },
  { marca: "CARLYLE", nombreComercial: "VITAMINA B COMPLEX", presentacion: "TABLETAS", dosaje: "-", contenido: "300", servingSize: "2.0", sabor: "NEUTRAL", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "COMPLEJO B", minimo: 1, maximo: 3, precio: 145 },
  { marca: "CARLYLE", nombreComercial: "VITAMINA B12", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5000 mcg", contenido: "250", servingSize: "1.0", sabor: "BAYAS", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "VITAMINA B12", minimo: 1, maximo: 2, precio: 135 },
  { marca: "HORBAACH", nombreComercial: "VITAMINA B12", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5000 mcg", contenido: "120", servingSize: "1.0", sabor: "BAYAS", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "VITAMINA B12", minimo: 6, maximo: 12, precio: 100 },
  { marca: "CARLYLE", nombreComercial: "VITAMINA C LIPOSOMAL", presentacion: "CAPSULAS BLANDAS", dosaje: "2200 mg", contenido: "90", servingSize: "2.0", sabor: "NARANJA", grupo: "SISTEMA INMUNE", subgrupo: "VITAMINA C", minimo: 2, maximo: 6, precio: 105 },
  { marca: "CARLYLE", nombreComercial: "VITAMINA D3", presentacion: "CAPSULAS BLANDAS", dosaje: "10000 IU", contenido: "400", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD OSEA E INMUNE", subgrupo: "D3", minimo: 0, maximo: 1, precio: 130 },
  { marca: "CARLYLE", nombreComercial: "VITAMINA D3", presentacion: "CAPSULAS BLANDAS", dosaje: "5000 IU", contenido: "500", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD OSEA E INMUNE", subgrupo: "D3", minimo: 0, maximo: 1, precio: 100 },
  { marca: "HORBAACH", nombreComercial: "VITAMINA E", presentacion: "CAPSULAS BLANDAS", dosaje: "450 mg", contenido: "200", servingSize: "1.0", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "VITAMINA E", minimo: 0, maximo: 2, precio: 205 },
  { marca: "NUBEST", nombreComercial: "VITAMINA PARA EL CRECIMIENTO +10 AÑOS", presentacion: "CAPSULAS", dosaje: "-", contenido: "60", servingSize: "1.0", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO", minimo: 0, maximo: 0, precio: 200 },
  { marca: "NORDIC NATURALS", nombreComercial: "ZERO AZUCAR DHA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "600 mg", contenido: "30", servingSize: "1.0", sabor: "FRUTAS CITRICAS", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 2, maximo: 6, precio: 120 },
  { marca: "NORDIC NATURALS", nombreComercial: "ZERO AZUCAR DHA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "600 mg", contenido: "45", servingSize: "1.0", sabor: "FRUTAS CITRICAS", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3", minimo: 0, maximo: 6, precio: 160 },
  { marca: "SWANSON", nombreComercial: "ZINC CARNOSIN", presentacion: "CAPSULAS", dosaje: "8 mg", contenido: "60", servingSize: "1.0", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PEPZINGI", minimo: 0, maximo: 0, precio: 105 },
  { marca: "MARY RUTH'S", nombreComercial: "ZINC IONICO ORGANICO", presentacion: "GOTERO", dosaje: "3 mg", contenido: "2 oz", servingSize: "66", sabor: "BAYAS", grupo: "SISTEMA INMUNE", subgrupo: "SULFATO DE ZINC", minimo: 1, maximo: 2, precio: 190 },
];

// Función para normalizar texto
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Función para generar clave única de comparación
function generarClave(marca: string, nombreComercial: string, contenido: string): string {
  return `${normalizar(marca)}-${normalizar(nombreComercial)}-${normalizar(contenido)}`;
}

export interface ActualizacionResult {
  actualizados: number;
  sinCoincidencia: number;
  skusGenerados: number;
  errores: number;
  detalles: {
    actualizados: string[];
    sinCoincidencia: string[];
    skusGenerados: string[];
    erroresDetalle: string[];
  };
}

/**
 * Actualiza productos existentes con datos del sistema antiguo
 */
export async function actualizarProductosConDatosAntiguos(
  onProgress?: (mensaje: string, progreso: number) => void
): Promise<ActualizacionResult> {
  const result: ActualizacionResult = {
    actualizados: 0,
    sinCoincidencia: 0,
    skusGenerados: 0,
    errores: 0,
    detalles: {
      actualizados: [],
      sinCoincidencia: [],
      skusGenerados: [],
      erroresDetalle: []
    }
  };

  onProgress?.('Obteniendo productos de Firebase...', 0);

  // Obtener todos los productos de Firebase
  const snapshot = await getDocs(collection(db, 'productos'));
  const productosFirebase = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  onProgress?.(`Encontrados ${productosFirebase.length} productos en Firebase`, 5);

  // Crear mapa de productos del sistema antiguo por clave
  const mapaSistemaAntiguo = new Map<string, ProductoSistemaAntiguo>();
  productosSistemaAntiguo.forEach(p => {
    const clave = generarClave(p.marca, p.nombreComercial, p.contenido);
    mapaSistemaAntiguo.set(clave, p);
  });

  // Obtener siguiente SKU disponible
  let maxSKUNumber = 0;
  productosFirebase.forEach((p: any) => {
    if (p.sku && typeof p.sku === 'string' && p.sku.startsWith('BMN-')) {
      const match = p.sku.match(/BMN-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSKUNumber) maxSKUNumber = num;
      }
    }
  });

  onProgress?.(`SKU máximo encontrado: BMN-${maxSKUNumber.toString().padStart(4, '0')}`, 10);

  const total = productosFirebase.length;

  for (let i = 0; i < productosFirebase.length; i++) {
    const producto: any = productosFirebase[i];
    const progreso = Math.round(10 + (i / total) * 85);

    onProgress?.(`Procesando ${i + 1}/${total}: ${producto.marca} - ${producto.nombreComercial}`, progreso);

    try {
      // Generar clave para buscar coincidencia
      const clave = generarClave(
        producto.marca || '',
        producto.nombreComercial || '',
        producto.contenido || ''
      );

      const datosAntiguos = mapaSistemaAntiguo.get(clave);
      const updateData: Record<string, any> = {
        ultimaEdicion: serverTimestamp()
      };

      let necesitaActualizar = false;

      // Si encontramos coincidencia, actualizar stockMinimo, stockMaximo, precioSugerido
      if (datosAntiguos) {
        // Solo actualizar si los valores actuales son 0 o 5/50 (valores por defecto)
        if (!producto.stockMinimo || producto.stockMinimo === 5) {
          updateData.stockMinimo = datosAntiguos.minimo;
          necesitaActualizar = true;
        }
        if (!producto.stockMaximo || producto.stockMaximo === 50) {
          updateData.stockMaximo = datosAntiguos.maximo;
          necesitaActualizar = true;
        }
        if (!producto.precioSugerido || producto.precioSugerido === 0) {
          updateData.precioSugerido = datosAntiguos.precio;
          necesitaActualizar = true;
        }
      } else {
        result.sinCoincidencia++;
        result.detalles.sinCoincidencia.push(`${producto.marca} - ${producto.nombreComercial} (${producto.contenido})`);
      }

      // Generar SKU si no tiene o está vacío
      if (!producto.sku || producto.sku.trim() === '') {
        maxSKUNumber++;
        updateData.sku = `BMN-${maxSKUNumber.toString().padStart(4, '0')}`;
        necesitaActualizar = true;
        result.skusGenerados++;
        result.detalles.skusGenerados.push(`${updateData.sku}: ${producto.marca} - ${producto.nombreComercial}`);
      }

      // Aplicar actualización si es necesario
      if (necesitaActualizar) {
        const docRef = doc(db, 'productos', producto.id);
        await updateDoc(docRef, updateData);

        if (datosAntiguos) {
          result.actualizados++;
          result.detalles.actualizados.push(
            `${producto.sku || updateData.sku}: ${producto.marca} - ${producto.nombreComercial} ` +
            `(Min: ${datosAntiguos.minimo}, Max: ${datosAntiguos.maximo}, Precio: S/${datosAntiguos.precio})`
          );
        }
      }

      // Pausa cada 20 productos
      if ((i + 1) % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error: any) {
      result.errores++;
      result.detalles.erroresDetalle.push(
        `${producto.marca} - ${producto.nombreComercial}: ${error.message}`
      );
    }
  }

  onProgress?.('Actualización completada', 100);

  return result;
}

// Exportar datos para uso externo
export { productosSistemaAntiguo };
