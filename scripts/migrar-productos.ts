/**
 * Script de migración de productos desde CSV del sistema antiguo
 * Ejecutar con: npx ts-node scripts/migrar-productos.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

// Configuración de Firebase (tomada de .env)
const firebaseConfig = {
  apiKey: "AIzaSyC-L9BxD2N3Cxa70m2JVF-zdAL9h3sXF6Q",
  authDomain: "businessmn-269c9.firebaseapp.com",
  projectId: "businessmn-269c9",
  storageBucket: "businessmn-269c9.firebasestorage.app",
  messagingSenderId: "607264167842",
  appId: "1:607264167842:web:9865b0aa9274f121adc4fb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Tipos
type Presentacion = 'tabletas' | 'gomitas' | 'capsulas' | 'capsulas_blandas' | 'polvo' | 'liquido';

interface ProductoCSV {
  suplemento: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  dosaje: string;
  contenido: string;
  servingSize: string;
  sabor: string;
  grupo: string;
  subgrupo: string;
}

// Datos del CSV
const productosCSV: ProductoCSV[] = [
  { suplemento: "5 HTP - NOW", marca: "NOW FOODS", nombreComercial: "5-HTP", presentacion: "CAPSULAS VEGETALES", dosaje: "100 mg", contenido: "120", servingSize: "1", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "5-HTP" },
  { suplemento: "60 BILLION PROBIOTIC - PHYSIANS CHOICE", marca: "PHYSICIAN'S CHOICE", nombreComercial: "60 BILLION PROBIOTIC", presentacion: "CAPSULAS", dosaje: "-", contenido: "30", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PROBIOTICOS + PREBIOTICOS" },
  { suplemento: "ACEITE DE HIGADO DE BACALAO CON D3 - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "ARTIC-D", presentacion: "LIQUIDO", dosaje: "1000 UI + 1060 mg", contenido: "8 oz", servingSize: "0.17", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "D3 + OMEGA 3" },
  { suplemento: "ACEITE DE OREGANO - CARLYLE", marca: "CARLYLE", nombreComercial: "ACEITE DE OREGANO", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "4000 mg", contenido: "150", servingSize: "2", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO" },
  { suplemento: "ACEITE DE OREGANO 2 OZ LIQUIDO - CARLYLE", marca: "CARLYLE", nombreComercial: "ACEITE DE OREGANO", presentacion: "GOTERO", dosaje: "34 mg", contenido: "2 oz", servingSize: "0.026", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO" },
  { suplemento: "ADULT GUMMIES 160 - KIRKLAND", marca: "KIRKLAND SIGNATURE", nombreComercial: "MULTIVITAMINICO PARA ADULTOS", presentacion: "GOMITAS", dosaje: "-", contenido: "160", servingSize: "2", sabor: "FRESA Y BAYAS", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA ADULTOS" },
  { suplemento: "ALLISURE POWDER - ALLIMAX", marca: "ALLIMAX", nombreComercial: "ALLISURE POWDER", presentacion: "CAPSULAS VEGETALES", dosaje: "180 mg", contenido: "30", servingSize: "1", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "ALLISURE POWDER" },
  { suplemento: "ALPHA LIPOIC ACID - MICROINGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "ALPHA LIPOIC ACID", presentacion: "CAPSULAS BLANDAS", dosaje: "600 mg", contenido: "120", servingSize: "3", sabor: "COCO", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "ALPHA LIPOIC ACID" },
  { suplemento: "ANTARTIC KRILL OIL - CARLYLE", marca: "CARLYLE", nombreComercial: "ANTARTIC KRILL OIL", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "2000 mg + 600 mcg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "KRILL OIL" },
  { suplemento: "ASHWAGHANDA - CARLYLE", marca: "CARLYLE", nombreComercial: "ASHWAGHANDA", presentacion: "CAPSULAS BLANDAS", dosaje: "3000 mg", contenido: "300", servingSize: "2", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "ASHWAGHANDA" },
  { suplemento: "ASHWAGHANDA - HOORBACH", marca: "HORBAACH", nombreComercial: "ASHWAGHANDA", presentacion: "CAPSULAS", dosaje: "450 mg", contenido: "120", servingSize: "4", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "ASHWAGHANDA" },
  { suplemento: "ASHWAGHANDA - NOW", marca: "NOW FOODS", nombreComercial: "ASHWAGHANDA", presentacion: "CAPSULAS VEGETALES", dosaje: "450 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "ASHWAGHANDA" },
  { suplemento: "ASTAXANTINA 12 MG - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "ASTAXANTINA", presentacion: "CAPSULAS BLANDAS", dosaje: "12 mg", contenido: "120", servingSize: "1", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "ASTANXATINA" },
  { suplemento: "B12 - CARLYLE", marca: "CARLYLE", nombreComercial: "VITAMINA B12", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5000 mcg", contenido: "250", servingSize: "1", sabor: "BAYAS", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "VITAMINA B12" },
  { suplemento: "BERBERINA - CARLYLE", marca: "CARLYLE", nombreComercial: "BERBERINA", presentacion: "CAPSULAS VEGETALES", dosaje: "500000 mcg", contenido: "60", servingSize: "2", sabor: "NEUTRAL", grupo: "METABOLISMO Y AZUCAR EN SANGRE", subgrupo: "BERBERINA" },
  { suplemento: "BERBERINA - HOORBACH", marca: "HORBAACH", nombreComercial: "BERBERINA", presentacion: "CAPSULAS VEGETALES", dosaje: "2000 mg", contenido: "120", servingSize: "1", sabor: "CANELA", grupo: "METABOLISMO Y AZUCAR EN SANGRE", subgrupo: "BERBERINA" },
  { suplemento: "BORO - NOW", marca: "NOW FOODS", nombreComercial: "BORO", presentacion: "CAPSULAS VEGETALES", dosaje: "3 mg", contenido: "250", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD OSEA / HORMONAL", subgrupo: "BORO" },
  { suplemento: "CALCIUM, D3 AND ZINC - KIRKLAND", marca: "KIRKLAND SIGNATURE", nombreComercial: "CALCIUM, D3 Y ZINC", presentacion: "GOMITAS", dosaje: "-", contenido: "120", servingSize: "2", sabor: "FRUTAS TROPICALES", grupo: "SALUD OSEA", subgrupo: "D3 + CALCIUM + ZINC" },
  { suplemento: "CAPSULAS MULTIVITAMINICAS MUJER + 50 - CENTRUM", marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE MUJER", presentacion: "CAPSULAS", dosaje: "-", contenido: "275", servingSize: "1", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA MUJER" },
  { suplemento: "CHILDREN GUMMIES 160 - KIRKLAND", marca: "KIRKLAND SIGNATURE", nombreComercial: "GOMITAS MULTIVITAMINICAS DE NIÑO", presentacion: "GOMITAS", dosaje: "-", contenido: "160", servingSize: "2", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO" },
  { suplemento: "CITICOLINE CDP - CARLYLE", marca: "CARLYLE", nombreComercial: "CITICOLINE CDP", presentacion: "CAPSULAS", dosaje: "1000 mg", contenido: "60", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "CITICOLINE CDP" },
  { suplemento: "CITRATO  DE MAGNESIO GOMITAS - DR MORITZ", marca: "DR. MORITZ", nombreComercial: "CITRATO DE MAGNESIO", presentacion: "GOMITAS", dosaje: "100 mg", contenido: "60", servingSize: "2", sabor: "FRAMBUESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "CITRATO DE MAGNESIO" },
  { suplemento: "COLLAGEN + BIOTIN 390 - YOUTHEORY", marca: "YOUTHEORY", nombreComercial: "COLLAGEN + BIOTIN", presentacion: "TABLETAS", dosaje: "6000 mg + 3000 mcg", contenido: "390", servingSize: "6", sabor: "NEUTRAL", grupo: "PIEL, ARTICULACIONES Y HUESOS", subgrupo: "COLAGENO" },
  { suplemento: "COMPLEJO B - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "COMPLEJO B", presentacion: "CAPSULAS VEGETALES", dosaje: "-", contenido: "60", servingSize: "2", sabor: "NEUTRAL", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "COMPLEJO B" },
  { suplemento: "COMPLEJO B - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "COMPLEJO B", presentacion: "CAPSULAS", dosaje: "-", contenido: "240", servingSize: "2", sabor: "NEUTRAL", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "COMPLEJO B" },
  { suplemento: "COMPLETE OMEGA JUNIOR LIMON CAPSULAS 180 - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "COMPLETE OMEGA JUNIOR", presentacion: "MINI CAPSULAS BLANDAS", dosaje: "283 mg + 35 mg", contenido: "180", servingSize: "2", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3 + GLA" },
  { suplemento: "COQ 10 - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "COQ 10", presentacion: "CAPSULAS BLANDAS", dosaje: "100 mg", contenido: "240", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "COQ 10" },
  { suplemento: "D3 10000IU - CARLYLE", marca: "CARLYLE", nombreComercial: "VITAMINA D3", presentacion: "CAPSULAS BLANDAS", dosaje: "10000 IU", contenido: "400", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD OSEA E INMUNE", subgrupo: "D3" },
  { suplemento: "D3 5000IU - CARLYLE", marca: "CARLYLE", nombreComercial: "VITAMINA D3", presentacion: "CAPSULAS BLANDAS", dosaje: "5000 IU", contenido: "500", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD OSEA E INMUNE", subgrupo: "D3" },
  { suplemento: "D3 K2 - CARLYLE", marca: "CARLYLE", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "10000 IU + 200 mcg", contenido: "300", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2" },
  { suplemento: "D3 K2 - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "5000 IU + 100 mcg", contenido: "300", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2" },
  { suplemento: "D3 K2 - NOW", marca: "NOW FOODS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS", dosaje: "1000 IU + 45 mcg", contenido: "120", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2" },
  { suplemento: "D3 K2 10000 - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "10000 IU + 200 mcg", contenido: "300", servingSize: "1", sabor: "COCO", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2" },
  { suplemento: "D3 K2 5000 - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", presentacion: "CAPSULAS BLANDAS", dosaje: "5000 IU + 100 mcg", contenido: "300", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD OSEA Y CARDIOVASCULAR", subgrupo: "D3 + K2" },
  { suplemento: "DETOXZEE - JOYSPRING", marca: "JOYSPRING", nombreComercial: "DETOXZEE", presentacion: "GOTERO", dosaje: "200 IU + 300 mcg", contenido: "1 oz", servingSize: "0.033", sabor: "BAYAS", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "D + B12" },
  { suplemento: "DIGESTIVE DROPS - COCO MARCH", marca: "COCO MARCH", nombreComercial: "DIGESTIVE DROPS", presentacion: "GOTERO", dosaje: "200 mg", contenido: "1 oz", servingSize: "0.014", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "EXTRACTO HUMICO MOLECULAR" },
  { suplemento: "ENZIMAS DIGESTIVAS - PHYSIANS CHOICE", marca: "PHYSICIAN'S CHOICE", nombreComercial: "ENZIMAS DIGESTIVAS", presentacion: "CAPSULAS", dosaje: "-", contenido: "60", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "ENZIMAS DIGESTIVAS" },
  { suplemento: "FOLATO OPTIMIZADO - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "FOLATO OPTIMIZADO", presentacion: "CAPSULAS VEGETALES", dosaje: "1700 mcg", contenido: "100", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD CELULAR", subgrupo: "5-MTHF" },
  { suplemento: "GINKGO LOBA - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "GINKGO BILOBA", presentacion: "CAPSULAS BLANDAS", dosaje: "120 mg", contenido: "400", servingSize: "2", sabor: "COCO", grupo: "SALUD COGNITIVA", subgrupo: "GINGKO BILOBA" },
  { suplemento: "GLUCOSAMINA CONDROITINA - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "GLUCOSAMINA CONDROITINA", presentacion: "TABLETA BISECTADA", dosaje: "4000 mg", contenido: "300", servingSize: "3", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "GLUCOSAMINA CONDROITINA" },
  { suplemento: "GOMITAS DHA XTRA - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "ZERO AZUCAR DHA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "600 mg", contenido: "30", servingSize: "1", sabor: "FRUTAS CITRICAS", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "GOMITAS MASTICABLES DHA 45 - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "ZERO AZUCAR DHA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "600 mg", contenido: "45", servingSize: "1", sabor: "FRUTAS CITRICAS", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "GOMITAS MULTIVITAMINICAS HOMBRE +50 - CENTRUM", marca: "CENTRUM", nombreComercial: "GOMITAS MULTIVITAMINICAS DE HOMBRE", presentacion: "GOMITAS", dosaje: "-", contenido: "170", servingSize: "2", sabor: "FRUTAS TROPICALES", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA HOMBRE" },
  { suplemento: "GOMITAS MULTIVITAMINICAS MUJER +50 - CENTRUM", marca: "CENTRUM", nombreComercial: "GOMITAS MULTIVITAMINICAS DE MUJER", presentacion: "GOMITAS", dosaje: "-", contenido: "170", servingSize: "2", sabor: "FRUTAS TROPICALES", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA MUJER" },
  { suplemento: "GOTAS GENIUS - JOYPSRING", marca: "JOYSPRING", nombreComercial: "GOTAS GENIUS", presentacion: "GOTERO", dosaje: "-", contenido: "1 oz", servingSize: "0.033", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "GINGKO BILOBA" },
  { suplemento: "KIDS MULTIVITAMIN - LIL CRITTERS", marca: "LIL CRITTER'S", nombreComercial: "GOMITAS MULTIVITAMINICAS DE NIÑO", presentacion: "GOMITAS", dosaje: "-", contenido: "300", servingSize: "2", sabor: "FRUTAS TROPICALES", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO" },
  { suplemento: "KRILL OIL - CARLYLE", marca: "CARLYLE", nombreComercial: "KRILL OIL", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "2000 mg + 600 mcg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3 + ASTAXANTINA" },
  { suplemento: "KRILL OIL - MICROINGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "KRILL OIL", presentacion: "CAPSULAS BLANDAS", dosaje: "2000 mg + 800 mcg", contenido: "240", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3 + ASTAXANTINA" },
  { suplemento: "KSM 66 + ASHWAGHANDA - NOW", marca: "NOW FOODS", nombreComercial: "KSM 66 + ASHWAGHANDA", presentacion: "CAPSULAS VEGETALES", dosaje: "600 mg", contenido: "90", servingSize: "2", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "KSM 66 + ASHWAGHANDA" },
  { suplemento: "L TEANINA - NOW", marca: "NOW FOODS", nombreComercial: "L-TEANINA", presentacion: "CAPSULAS VEGETALES", dosaje: "100 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "L-TEANINA" },
  { suplemento: "L TREONATO DE MAGNESIO - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "MAGTEIN", presentacion: "CAPSULAS VEGETALES", dosaje: "144 mg", contenido: "90", servingSize: "3", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MAGNESIO L-TREONATO" },
  { suplemento: "LINGO LEAP - JOYSPRING", marca: "JOYSPRING", nombreComercial: "LINGO LEAP", presentacion: "GOTERO", dosaje: "-", contenido: "1 oz", servingSize: "0.033", sabor: "FRAMBUESAS", grupo: "SALUD COGNITIVA", subgrupo: "EXTRACTO HERBAL" },
  { suplemento: "LIONS MANE 2 OZ LIQUIDO - CARLYLE", marca: "CARLYLE", nombreComercial: "MELENA DE LEON", presentacion: "GOTERO", dosaje: "2 ml", contenido: "2 oz", servingSize: "0.066", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MELENA DE LEON" },
  { suplemento: "LIPOSOMAL - CARLYLE", marca: "CARLYLE", nombreComercial: "VITAMINA C LIPOSOMAL", presentacion: "CAPSULAS BLANDAS", dosaje: "2200 mg", contenido: "90", servingSize: "2", sabor: "NARANJA", grupo: "SISTEMA INMUNE", subgrupo: "VITAMINA C" },
  { suplemento: "LUTEINA - CARLYLE", marca: "CARLYLE", nombreComercial: "LUTEINA", presentacion: "CAPSULAS BLANDAS", dosaje: "40 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD VISUAL", subgrupo: "LUTEINA" },
  { suplemento: "MAGNESIO GLYCINATE - DOCTOR BEST", marca: "DOCTOR'S BEST", nombreComercial: "MAGNESIO GLICINATO", presentacion: "TABLETAS", dosaje: "200 mg", contenido: "240", servingSize: "2", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO" },
  { suplemento: "MAGNESIO GLYCINATE - DOUBLE WOOD", marca: "DOUBLE WOOD", nombreComercial: "MAGNESIO GLICINATO", presentacion: "CAPSULAS VEGETALES", dosaje: "400 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO" },
  { suplemento: "MAGNESIUM + ASHWAGHANDA - CARLYLE", marca: "CARLYLE", nombreComercial: "MAGNESIO + ASHWAGHANDA", presentacion: "CAPSULAS BLANDAS", dosaje: "150 mg + 1500 mg", contenido: "120", servingSize: "3", sabor: "NEUTRAL", grupo: "MANEJO DEL ESTRES Y ENERGIIA", subgrupo: "MAGNESIO + ASHWAGHANDA" },
  { suplemento: "MAGNESIUM BISGLICINATE - CARLYLE", marca: "CARLYLE", nombreComercial: "MAGNESIO BISGLICINATO", presentacion: "CAPSULAS", dosaje: "665 mg", contenido: "250", servingSize: "1", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "BISGLICINATO DE MAGNESIO" },
  { suplemento: "MAGNESIUM FOR KIDS - DR. MORITZ", marca: "DR. MORITZ", nombreComercial: "MAGNESIO PARA NIÑOS", presentacion: "GOMITAS", dosaje: "100 mg", contenido: "60", servingSize: "2", sabor: "FRAMBUESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "CITRATO DE MAGNESIO" },
  { suplemento: "MAGNESIUM GLYCINATE - HOORBACH", marca: "HORBAACH", nombreComercial: "MAGNESIO GLICINATO", presentacion: "CAPSULAS", dosaje: "1330 mg", contenido: "250", servingSize: "2", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO" },
  { suplemento: "MAGNESIUM GLYCINATE - SOLARAY", marca: "SOLARAY", nombreComercial: "MAGNESIO GLICINATO", presentacion: "CAPSULAS VEGETALES", dosaje: "350 mg", contenido: "120", servingSize: "4", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "GLICINATO DE MAGNESIO" },
  { suplemento: "MAGTEIN - DOUBLE WOOD", marca: "DOUBLE WOOD", nombreComercial: "MAGTEIN", presentacion: "CAPSULAS", dosaje: "2000 mg", contenido: "120", servingSize: "4", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MAGNESIO L-TREONATO" },
  { suplemento: "MELATONINA - NATROL", marca: "NATROL", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5 mg", contenido: "200", servingSize: "1", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA & L TEANINA KIDS 60 - NATROL", marca: "NATROL", nombreComercial: "MELATONINA +  L-TEANINA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "1 mg + 25 mg", contenido: "60", servingSize: "2", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA + L-TEANINA" },
  { suplemento: "MELATONINA 20MG - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "20 mg", contenido: "400", servingSize: "1", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA 250 - NATROL", marca: "NATROL", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5 mg", contenido: "250", servingSize: "1", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA 40MG - CARLYLE", marca: "CARLYLE", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "40 mg", contenido: "150", servingSize: "1", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA 5 MG 300 - CARLYLE", marca: "CARLYLE", nombreComercial: "MELATONINA", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5 mg", contenido: "300", servingSize: "1", sabor: "NEUTRAL", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA GOMITAS 10 MG - NATROL", marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA ADULTOS", presentacion: "GOMITAS", dosaje: "10 mg", contenido: "190", servingSize: "2", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA KIDS 140 - NATROL", marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "1 mg", contenido: "140", servingSize: "1", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA KIDS 90 - NATROL", marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA NIÑOS", presentacion: "GOMITAS", dosaje: "1 mg", contenido: "90", servingSize: "1", sabor: "FRESA", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELATONINA TABLETAS 12 MG - CARLYLE", marca: "CARLYLE", nombreComercial: "GOMITAS DE MELATONINA PARA ADULTOS", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "12 mg", contenido: "300", servingSize: "1", sabor: "BAYAS", grupo: "SUEÑO Y RELAJACION", subgrupo: "MELATONINA" },
  { suplemento: "MELENA DE LEON - HOORBACH", marca: "HORBAACH", nombreComercial: "MELENA DE LEON", presentacion: "CAPSULAS VEGETALES", dosaje: "4200 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MELENA DE LEON" },
  { suplemento: "METHYLFOLATE - HOORBACH", marca: "HORBAACH", nombreComercial: "5-MTHF", presentacion: "CAPSULAS", dosaje: "1000 mcg", contenido: "200", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD CELULAR", subgrupo: "5-MTHF" },
  { suplemento: "MILK THISTLE/CARDO MARIANO - HOORBACH", marca: "HORBAACH", nombreComercial: "CARDO MARIANO", presentacion: "CAPSULAS", dosaje: "3000 mg", contenido: "300", servingSize: "3", sabor: "NEUTRAL", grupo: "SALUD HEPATICA", subgrupo: "CARDO MARIANO" },
  { suplemento: "MULTI COLLAGEN - SPORTS RESEARCH", marca: "SPORTS RESEARCH", nombreComercial: "MULTI COLAGENO", presentacion: "CAPSULAS", dosaje: "1600 mg", contenido: "90", servingSize: "3", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "COLAGENO" },
  { suplemento: "MULTIVITAMIN ADULTS 200 - CENTRUM", marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE ADULTO", presentacion: "CAPSULAS", dosaje: "-", contenido: "200", servingSize: "1", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA ADULTOS" },
  { suplemento: "MULTIVITAMIN MENS 200 - CENTRUM", marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE HOMBRE", presentacion: "CAPSULAS", dosaje: "-", contenido: "200", servingSize: "2", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA HOMBRE" },
  { suplemento: "MULTIVITAMINICO LIQUIDO 450ML FRAMBUESA - MARY RUTH", marca: "MARY RUTH'S", nombreComercial: "LIQUIDO MULTIVITAMINICO", presentacion: "LIQUIDO", dosaje: "-", contenido: "15.22 oz", servingSize: "1.014", sabor: "FRAMBUESA", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO" },
  { suplemento: "MULTIVITAMINICO PARA EL CABELLO 450ML MANGO - MARY RUTH", marca: "MARY RUTH'S", nombreComercial: "LIQUIDO MULTIVITAMINICO + CRECIMIENTO DEL CABELLO", presentacion: "LIQUIDO", dosaje: "-", contenido: "15.22 oz", servingSize: "1.014", sabor: "MANGO", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO" },
  { suplemento: "MYO INOSITOL - CARLYLE", marca: "CARLYLE", nombreComercial: "MYO INOSITOL", presentacion: "CAPSULAS", dosaje: "2060 mg", contenido: "150", servingSize: "4", sabor: "NEUTRAL", grupo: "SALUD HORMONAL", subgrupo: "MYO INOSITOL" },
  { suplemento: "NAD+ - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "NAD+", presentacion: "CAPSULAS VEGETALES", dosaje: "100 mg", contenido: "30", servingSize: "1", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "NAD" },
  { suplemento: "NAD+ RESVERATROL - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "NAD + RESVERATROL", presentacion: "CAPSULAS VEGETALES", dosaje: "55 mg + 300 mg", contenido: "30", servingSize: "1", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "RESVERATROL + NAD" },
  { suplemento: "NEUROMAG - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "NEUROMAG", presentacion: "CAPSULAS VEGETALES", dosaje: "144 mg", contenido: "90", servingSize: "3", sabor: "NEUTRAL", grupo: "SALUD COGNITIVA", subgrupo: "MAGNESIO L-TREONATO" },
  { suplemento: "OIL OF OREGANO - MICROINGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "ACEITE DE OREGANO", presentacion: "CAPSULAS BLANDAS", dosaje: "6000 mg", contenido: "300", servingSize: "2", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO" },
  { suplemento: "OIL OF OREGANO - PIPPING ROCK", marca: "PIPPING ROCK", nombreComercial: "ACEITE DE OREGANO", presentacion: "CAPSULAS BLANDAS DE LIBERACION RAPIDA", dosaje: "4000 mg", contenido: "200", servingSize: "2", sabor: "OREGANO", grupo: "SISTEMA INMUNE", subgrupo: "ACEITE DE OREGANO" },
  { suplemento: "OMEGA 3 - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "OMEGA 3", presentacion: "CAPSULAS BLANDAS", dosaje: "4200 mg", contenido: "240", servingSize: "3", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "OMEGA 3 ALASKA - SPORTS RESEARCH", marca: "SPORTS RESEARCH", nombreComercial: "ALASKA OMEGA 3", presentacion: "CAPSULAS BLANDAS", dosaje: "1040 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "OMEGA 3 LIMON - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "OMEGA 3", presentacion: "LIQUIDO", dosaje: "1560 mg", contenido: "8 oz", servingSize: "0.17", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "OMEGA 369 - NOW", marca: "NOW FOODS", nombreComercial: "OMEGA 369", presentacion: "CAPSULAS BLANDAS", dosaje: "1400 mg", contenido: "250", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "ORGANIC KIDS METHYLFOLATO - TRIQUETRA", marca: "TRIQUETRA", nombreComercial: "FOLATO DE METILO ORGANICO PARA NIÑOS", presentacion: "GOTERO", dosaje: "1 oz", contenido: "1 oz", servingSize: "0.04", sabor: "BAYAS", grupo: "SALUD CELULAR", subgrupo: "5-MTHF" },
  { suplemento: "PEPTIDOS DE COLAGENO - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "POLVO DE PEPTIDOS DE COLAGENO", presentacion: "POLVO", dosaje: "10888 mg", contenido: "1 lb", servingSize: "0.024", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "COLAGENO" },
  { suplemento: "PEPTIDOS DE COLAGENO CAPSULAS - MICROINGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "CAPSULAS DE PEPTIDOS DE COLAGENO", presentacion: "CAPSULAS", dosaje: "1100 mg", contenido: "240", servingSize: "3", sabor: "NEUTRAL", grupo: "SALUD OSEA", subgrupo: "COLAGENO" },
  { suplemento: "PEPZIN GI - DOCTORS BEST", marca: "DOCTOR'S BEST", nombreComercial: "PEPZIN GI", presentacion: "CAPSULAS VEGETALES", dosaje: "75 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PEPZINGI" },
  { suplemento: "PONCHE DHA BABY - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "DHA PARA BEBES", presentacion: "LIQUIDO", dosaje: "300 IU + 1050 mg", contenido: "2 oz", servingSize: "0.042", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "D3 + OMEGA 3" },
  { suplemento: "PONCHE DHA XTRA - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "DHA XTRA", presentacion: "LIQUIDO", dosaje: "880 mg", contenido: "2 oz", servingSize: "0.042", sabor: "BAYAS", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "PREBIOTIC PROBIOTIC 50 BILLION - CARLYLE", marca: "CARLYLE", nombreComercial: "PREBIOTICOS + PROBIOTICOS 50 BILLION", presentacion: "CAPSULAS VEGETALES", dosaje: "142 mg + 200 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PROBIOTICOS + PREBIOTICOS" },
  { suplemento: "PUMPKIN - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "CAPSULAS DE ACEITE DE SEMILLA DE CALABAZA", presentacion: "CAPSULAS BLANDAS", dosaje: "3000 mg", contenido: "300", servingSize: "3", sabor: "CALABAZA", grupo: "SALUD HORMONAL", subgrupo: "ACEITE DE SEMILLA DE CALABAZA" },
  { suplemento: "REFUERZO CANDIDA - NOW", marca: "NOW FOODS", nombreComercial: "REFUERZO DE CANDIDA", presentacion: "CAPSULAS VEGETALES", dosaje: "-", contenido: "180", servingSize: "2", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "REFUERZO DE CANDIDA" },
  { suplemento: "RESVERATROL - CARLYLE", marca: "CARLYLE", nombreComercial: "RESVERATROL", presentacion: "CAPSULAS DE LIBERACION RAPIDA", dosaje: "1800 mg", contenido: "180", servingSize: "3", sabor: "UVA", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "RESVERATROL" },
  { suplemento: "RESVERATROL + NAD - WELLNESS", marca: "WELLNESS LABS RX", nombreComercial: "NAD + RESVERATROL", presentacion: "CAPSULAS VEGETALES", dosaje: "300 mg + 1200 mg", contenido: "90", servingSize: "2", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "RESVERATROL + NAD" },
  { suplemento: "ROLL ON - ICY HOT", marca: "ICY HOT", nombreComercial: "ICY HOT", presentacion: "ROLL ON", dosaje: "-", contenido: "2.5 oz", servingSize: "0.028", sabor: "MENTOL", grupo: "USO TOPICO", subgrupo: "ICY HOT" },
  { suplemento: "SELENIUM - CARLYLE", marca: "CARLYLE", nombreComercial: "SELENIO", presentacion: "CAPSULAS VEGETALES", dosaje: "200 mcg", contenido: "200", servingSize: "1", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "SELENIO" },
  { suplemento: "SHILAJIT - CARLYLE", marca: "CARLYLE", nombreComercial: "SHILAJIT", presentacion: "CAPSULAS DE LIBERACION RAPIDA", dosaje: "2000 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "SHILAJIT" },
  { suplemento: "SPIRULINA CHLORELLA - MICRO INGREDIENTS", marca: "MICROINGREDIENTS", nombreComercial: "ESPIRULINA DE CHLORELLA", presentacion: "PASTILLAS", dosaje: "3000 mg", contenido: "720", servingSize: "6", sabor: "NEUTRAL", grupo: "SISTEMA INMUNE", subgrupo: "SPIRULINA" },
  { suplemento: "SPRAY - ICY HOT", marca: "ICY HOT", nombreComercial: "ICY HOT", presentacion: "SPRAY", dosaje: "-", contenido: "4 oz", servingSize: "0.044", sabor: "MENTOL", grupo: "USO TOPICO", subgrupo: "ICY HOT" },
  { suplemento: "SUPER ENZIMAS - NOW", marca: "NOW FOODS", nombreComercial: "SUPER ENZIMAS", presentacion: "CAPSULAS", dosaje: "-", contenido: "180", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "ENZIMAS DIGESTIVAS" },
  { suplemento: "SUPER OMEGA 3 PLUS - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "SUPER OMEGA 3 PLUS", presentacion: "CAPSULAS BLANDAS", dosaje: "2350 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "SUPER UBIQUINOL COQ 10 100MG - LIFE EXTENSION", marca: "LIFE EXTENSION", nombreComercial: "COQ 10", presentacion: "CAPSULAS BLANDAS", dosaje: "100 mg", contenido: "60", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "COQ 10" },
  { suplemento: "TONGKAT ALI - HOORBACH", marca: "HORBAACH", nombreComercial: "TONGKAT ALI", presentacion: "CAPSULAS DE LIBERACION RAPIDA", dosaje: "1600 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL", grupo: "SALUD HORMONAL", subgrupo: "LONGJACK" },
  { suplemento: "ULTIMA OMEGA ADOLESCENTES 12 AÑOS FRESA CAPSULAS 60 - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA TEEN", presentacion: "MINI CAPSULAS BLANDAS", dosaje: "1120 mg", contenido: "60", servingSize: "2", sabor: "FRESA", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "ULTIMA OMEGA LIMON 4OZ - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA", presentacion: "LIQUIDO", dosaje: "2840 mg", contenido: "4 oz", servingSize: "0.17", sabor: "LIMON", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "ULTIMA OMEGA NIÑOS 6 AÑOS FRESA CAPSULAS 90  - NORDIC NATURALS", marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA KIDS", presentacion: "MINI CAPSULAS BLANDAS", dosaje: "680 mg", contenido: "90", servingSize: "2", sabor: "FRESA", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "ULTRA OMEGA 3 - NOW", marca: "NOW FOODS", nombreComercial: "ULTRA OMEGA 3 - CEREBRO Y CORAZON", presentacion: "CAPSULAS BLANDAS", dosaje: "750 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "ULTRA OMEGA 3 CARDIOVASCULAR - NOW", marca: "NOW FOODS", nombreComercial: "ULTRA OMEGA 3 - CARDIOVASCULAR", presentacion: "CAPSULAS BLANDAS", dosaje: "750 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD CARDIOVASCULAR Y CEREBRAL", subgrupo: "OMEGA 3" },
  { suplemento: "VINAGRE DE MANZANA - NATURES TRUTH", marca: "NATURE'S TRUTH", nombreComercial: "VINAGRE DE MANZANA", presentacion: "CAPSULAS", dosaje: "1200 mg", contenido: "60", servingSize: "2", sabor: "MANZANA", grupo: "SALUD DIGESTIVA", subgrupo: "VINAGRE DE MANZANA" },
  { suplemento: "VITAMINA B COMPLEX - CARLYLE", marca: "CARLYLE", nombreComercial: "VITAMINA B COMPLEX", presentacion: "TABLETAS", dosaje: "-", contenido: "300", servingSize: "2", sabor: "NEUTRAL", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "COMPLEJO B" },
  { suplemento: "VITAMINA B12 - HOORBACH", marca: "HORBAACH", nombreComercial: "VITAMINA B12", presentacion: "TABLETA DE DISOLUCION RAPIDA", dosaje: "5000 mcg", contenido: "120", servingSize: "1", sabor: "BAYAS", grupo: "ENERGIA Y SISTEMA NERVIOSO", subgrupo: "VITAMINA B12" },
  { suplemento: "VITAMINA E - HOORBACH", marca: "HORBAACH", nombreComercial: "VITAMINA E", presentacion: "CAPSULAS BLANDAS", dosaje: "450 mg", contenido: "200", servingSize: "1", sabor: "NEUTRAL", grupo: "ANTIOXIDANTE Y METABOLISMO", subgrupo: "VITAMINA E" },
  { suplemento: "VITAMINA PARA EL CRECIMIENTO - NUBEST", marca: "NUBEST", nombreComercial: "VITAMINA PARA EL CRECIMIENTO +10 AÑOS", presentacion: "CAPSULAS", dosaje: "-", contenido: "60", servingSize: "1", sabor: "NEUTRAL", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA NIÑO" },
  { suplemento: "WOMENS MULTIVITAMIN 220 - VITAFUSION", marca: "VITAFUSION", nombreComercial: "GOMITAS MULTIVITAMINICAS DE MUJER", presentacion: "GOMITAS", dosaje: "-", contenido: "220", servingSize: "2", sabor: "BAYAS", grupo: "MULTIVITAMINICOS", subgrupo: "MULTIVITAMINICO PARA MUJER" },
  { suplemento: "ZINC CARNOSINE - SWANSON", marca: "SWANSON", nombreComercial: "ZINC CARNOSIN", presentacion: "CAPSULAS", dosaje: "8 mg", contenido: "60", servingSize: "1", sabor: "NEUTRAL", grupo: "SALUD DIGESTIVA", subgrupo: "PEPZINGI" },
  { suplemento: "ZINC IONICO ORGANICO LIQUIDO 4 A 13 AÑOS - MARY RUTH", marca: "MARY RUTH'S", nombreComercial: "ZINC IONICO ORGANICO", presentacion: "GOTERO", dosaje: "3 mg", contenido: "2 oz", servingSize: "0.066", sabor: "BAYAS", grupo: "SISTEMA INMUNE", subgrupo: "SULFATO DE ZINC" },
];

// Función para convertir presentación del CSV al tipo del sistema
function convertirPresentacion(presentacionCSV: string): Presentacion {
  const presentacionUpper = presentacionCSV.toUpperCase();

  if (presentacionUpper.includes('GOMITAS') || presentacionUpper.includes('GOMITA')) {
    return 'gomitas';
  }
  if (presentacionUpper.includes('CAPSULAS BLANDAS') || presentacionUpper.includes('MINI CAPSULAS BLANDAS')) {
    return 'capsulas_blandas';
  }
  if (presentacionUpper.includes('CAPSULA') || presentacionUpper.includes('CAPSULAS')) {
    return 'capsulas';
  }
  if (presentacionUpper.includes('TABLETA') || presentacionUpper.includes('TABLETAS') || presentacionUpper.includes('PASTILLAS')) {
    return 'tabletas';
  }
  if (presentacionUpper.includes('LIQUIDO') || presentacionUpper.includes('GOTERO') ||
      presentacionUpper.includes('ROLL ON') || presentacionUpper.includes('SPRAY')) {
    return 'liquido';
  }
  if (presentacionUpper.includes('POLVO')) {
    return 'polvo';
  }

  // Default
  return 'capsulas';
}

// Función para normalizar texto (para comparación)
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, '') // Solo alfanuméricos
    .trim();
}

// Función para generar clave única de producto
function generarClaveProducto(marca: string, nombreComercial: string, dosaje: string, contenido: string): string {
  return `${normalizar(marca)}-${normalizar(nombreComercial)}-${normalizar(dosaje)}-${normalizar(contenido)}`;
}

// Función para generar SKU
async function generateSKU(): Promise<string> {
  const snapshot = await getDocs(collection(db, 'productos'));

  let maxNumber = 0;
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const sku = data.sku as string;

    if (sku && sku.startsWith('BMN-')) {
      const match = sku.match(/BMN-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  return `BMN-${(maxNumber + 1).toString().padStart(4, '0')}`;
}

async function migrarProductos() {
  console.log('🚀 Iniciando migración de productos...\n');

  // 1. Obtener productos existentes
  console.log('📦 Obteniendo productos existentes...');
  const snapshotExistentes = await getDocs(
    query(collection(db, 'productos'), orderBy('fechaCreacion', 'desc'))
  );

  const productosExistentes = new Map<string, any>();
  snapshotExistentes.docs.forEach(doc => {
    const data = doc.data();
    const clave = generarClaveProducto(
      data.marca || '',
      data.nombreComercial || '',
      data.dosaje || '',
      data.contenido || ''
    );
    productosExistentes.set(clave, { id: doc.id, ...data });
  });

  console.log(`   Encontrados ${productosExistentes.size} productos existentes\n`);

  // 2. Procesar productos del CSV
  let creados = 0;
  let omitidos = 0;
  let errores = 0;
  const productosCreados: string[] = [];
  const productosOmitidos: string[] = [];

  // También rastrear duplicados dentro del mismo CSV
  const clavesYaProcesadas = new Set<string>();

  for (const productoCSV of productosCSV) {
    const clave = generarClaveProducto(
      productoCSV.marca,
      productoCSV.nombreComercial,
      productoCSV.dosaje,
      productoCSV.contenido
    );

    // Verificar si ya existe o ya se procesó
    if (productosExistentes.has(clave) || clavesYaProcesadas.has(clave)) {
      omitidos++;
      productosOmitidos.push(`${productoCSV.marca} - ${productoCSV.nombreComercial} (${productoCSV.contenido})`);
      continue;
    }

    clavesYaProcesadas.add(clave);

    try {
      const sku = await generateSKU();
      const presentacion = convertirPresentacion(productoCSV.presentacion);
      const servingsPerDay = parseFloat(productoCSV.servingSize) || 1;

      // Calcular ciclo de recompra
      const contenidoNumerico = parseFloat(productoCSV.contenido) || 0;
      const cicloRecompraDias = contenidoNumerico > 0 && servingsPerDay > 0
        ? Math.round(contenidoNumerico / servingsPerDay)
        : undefined;

      const nuevoProducto = {
        sku,
        marca: productoCSV.marca,
        nombreComercial: productoCSV.nombreComercial,
        presentacion,
        dosaje: productoCSV.dosaje === '-' ? '' : productoCSV.dosaje,
        contenido: productoCSV.contenido,
        sabor: productoCSV.sabor === 'NEUTRAL' ? '' : productoCSV.sabor,
        grupo: productoCSV.grupo,
        subgrupo: productoCSV.subgrupo,

        enlaceProveedor: '',
        codigoUPC: '',

        estado: 'activo',
        etiquetas: [],

        habilitadoML: true,
        restriccionML: '',

        ctruPromedio: 0,
        precioSugerido: 0,
        margenMinimo: 20,
        margenObjetivo: 30,
        costoFleteUSAPeru: 0,

        stockUSA: 0,
        stockPeru: 0,
        stockTransito: 0,
        stockReservado: 0,
        stockDisponible: 0,

        stockMinimo: 5,
        stockMaximo: 50,

        rotacionPromedio: 0,
        diasParaQuiebre: 0,

        esPadre: false,

        servingsPerDay,
        cicloRecompraDias,

        creadoPor: 'sistema-migracion',
        fechaCreacion: serverTimestamp(),
      };

      await addDoc(collection(db, 'productos'), nuevoProducto);
      creados++;
      productosCreados.push(`${sku}: ${productoCSV.marca} - ${productoCSV.nombreComercial}`);

      // Pequeña pausa para no sobrecargar Firestore
      if (creados % 10 === 0) {
        console.log(`   ✅ Creados ${creados} productos...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      errores++;
      console.error(`   ❌ Error creando ${productoCSV.marca} - ${productoCSV.nombreComercial}:`, error);
    }
  }

  // 3. Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(60));
  console.log(`✅ Productos creados: ${creados}`);
  console.log(`⏭️  Productos omitidos (duplicados): ${omitidos}`);
  console.log(`❌ Errores: ${errores}`);
  console.log(`📦 Total en sistema: ${productosExistentes.size + creados}`);

  if (productosOmitidos.length > 0 && productosOmitidos.length <= 20) {
    console.log('\n📋 Productos omitidos:');
    productosOmitidos.forEach(p => console.log(`   - ${p}`));
  }

  console.log('\n✨ Migración completada!');
}

// Ejecutar
migrarProductos().catch(console.error);
