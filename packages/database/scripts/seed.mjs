import { Pool } from 'pg';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

async function seedGlobalRegistry(client) {
  console.log('[seed] seeding global registry (Layer A)...');

  // ── Markets (34) ──────────────────────────────────────────
  const markets = [
    { code:'us', name:'United States', currency:'USD', timezone:'America/New_York', flag:'\u{1F1FA}\u{1F1F8}', region:'NA' },
    { code:'ca', name:'Canada', currency:'CAD', timezone:'America/Toronto', flag:'\u{1F1E8}\u{1F1E6}', region:'NA' },
    { code:'mx', name:'Mexico', currency:'MXN', timezone:'America/Mexico_City', flag:'\u{1F1F2}\u{1F1FD}', region:'NA' },
    { code:'uk', name:'United Kingdom', currency:'GBP', timezone:'Europe/London', flag:'\u{1F1EC}\u{1F1E7}', region:'EU' },
    { code:'de', name:'Germany', currency:'EUR', timezone:'Europe/Berlin', flag:'\u{1F1E9}\u{1F1EA}', region:'EU' },
    { code:'fr', name:'France', currency:'EUR', timezone:'Europe/Paris', flag:'\u{1F1EB}\u{1F1F7}', region:'EU' },
    { code:'it', name:'Italy', currency:'EUR', timezone:'Europe/Rome', flag:'\u{1F1EE}\u{1F1F9}', region:'EU' },
    { code:'es', name:'Spain', currency:'EUR', timezone:'Europe/Madrid', flag:'\u{1F1EA}\u{1F1F8}', region:'EU' },
    { code:'nl', name:'Netherlands', currency:'EUR', timezone:'Europe/Amsterdam', flag:'\u{1F1F3}\u{1F1F1}', region:'EU' },
    { code:'pl', name:'Poland', currency:'PLN', timezone:'Europe/Warsaw', flag:'\u{1F1F5}\u{1F1F1}', region:'EU' },
    { code:'se', name:'Sweden', currency:'SEK', timezone:'Europe/Stockholm', flag:'\u{1F1F8}\u{1F1EA}', region:'EU' },
    { code:'be', name:'Belgium', currency:'EUR', timezone:'Europe/Brussels', flag:'\u{1F1E7}\u{1F1EA}', region:'EU' },
    { code:'ie', name:'Ireland', currency:'EUR', timezone:'Europe/Dublin', flag:'\u{1F1EE}\u{1F1EA}', region:'EU' },
    { code:'at', name:'Austria', currency:'EUR', timezone:'Europe/Vienna', flag:'\u{1F1E6}\u{1F1F9}', region:'EU' },
    { code:'cz', name:'Czech Republic', currency:'CZK', timezone:'Europe/Prague', flag:'\u{1F1E8}\u{1F1FF}', region:'EU' },
    { code:'ro', name:'Romania', currency:'RON', timezone:'Europe/Bucharest', flag:'\u{1F1F7}\u{1F1F4}', region:'EU' },
    { code:'pt', name:'Portugal', currency:'EUR', timezone:'Europe/Lisbon', flag:'\u{1F1F5}\u{1F1F9}', region:'EU' },
    { code:'jp', name:'Japan', currency:'JPY', timezone:'Asia/Tokyo', flag:'\u{1F1EF}\u{1F1F5}', region:'APAC' },
    { code:'sg', name:'Singapore', currency:'SGD', timezone:'Asia/Singapore', flag:'\u{1F1F8}\u{1F1EC}', region:'APAC' },
    { code:'au', name:'Australia', currency:'AUD', timezone:'Australia/Sydney', flag:'\u{1F1E6}\u{1F1FA}', region:'APAC' },
    { code:'in', name:'India', currency:'INR', timezone:'Asia/Kolkata', flag:'\u{1F1EE}\u{1F1F3}', region:'APAC' },
    { code:'ae', name:'UAE', currency:'AED', timezone:'Asia/Dubai', flag:'\u{1F1E6}\u{1F1EA}', region:'MENA' },
    { code:'sa', name:'Saudi Arabia', currency:'SAR', timezone:'Asia/Riyadh', flag:'\u{1F1F8}\u{1F1E6}', region:'MENA' },
    { code:'eg', name:'Egypt', currency:'EGP', timezone:'Africa/Cairo', flag:'\u{1F1EA}\u{1F1EC}', region:'MENA' },
    { code:'za', name:'South Africa', currency:'ZAR', timezone:'Africa/Johannesburg', flag:'\u{1F1FF}\u{1F1E6}', region:'APAC' },
    { code:'br', name:'Brazil', currency:'BRL', timezone:'America/Sao_Paulo', flag:'\u{1F1E7}\u{1F1F7}', region:'LATAM' },
    { code:'tr', name:'Turkey', currency:'TRY', timezone:'Europe/Istanbul', flag:'\u{1F1F9}\u{1F1F7}', region:'EU' },
    { code:'id', name:'Indonesia', currency:'IDR', timezone:'Asia/Jakarta', flag:'\u{1F1EE}\u{1F1E9}', region:'APAC' },
    { code:'my', name:'Malaysia', currency:'MYR', timezone:'Asia/Kuala_Lumpur', flag:'\u{1F1F2}\u{1F1FE}', region:'APAC' },
    { code:'th', name:'Thailand', currency:'THB', timezone:'Asia/Bangkok', flag:'\u{1F1F9}\u{1F1ED}', region:'APAC' },
    { code:'vn', name:'Vietnam', currency:'VND', timezone:'Asia/Ho_Chi_Minh', flag:'\u{1F1FB}\u{1F1F3}', region:'APAC' },
    { code:'ph', name:'Philippines', currency:'PHP', timezone:'Asia/Manila', flag:'\u{1F1F5}\u{1F1ED}', region:'APAC' },
    { code:'cl', name:'Chile', currency:'CLP', timezone:'America/Santiago', flag:'\u{1F1E8}\u{1F1F1}', region:'LATAM' },
  ];
  for (const m of markets) {
    await client.query(
      `INSERT INTO "GlobalMarket" (id,code,name,currency,timezone,flag,region,enabled,"createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,true,NOW(),NOW())
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,currency=EXCLUDED.currency,timezone=EXCLUDED.timezone,flag=EXCLUDED.flag,region=EXCLUDED.region`,
      [m.code, m.name, m.currency, m.timezone, m.flag, m.region]
    );
  }
  console.log(`[seed]   GlobalMarket: ${markets.length} entries`);

  // ── Platforms (7) ─────────────────────────────────────────
  await client.query(`DELETE FROM "GlobalPlatform"`);
  const AMZ_21 = ['us','ca','mx','br','uk','de','fr','it','es','nl','pl','se','be','tr','jp','in','au','sg','ae','sa','eg'];
  const EBAY_13 = ['us','ca','uk','au','de','fr','it','es','at','be','ie','nl','pl'];
  const TIKTOK_16 = ['us','mx','uk','de','fr','it','es','ie','jp','sg','id','my','th','vn','ph','br'];
  const TEMU_20 = ['us','ca','uk','de','fr','it','es','nl','pl','se','at','be','cz','ro','pt','ie','jp','au','mx','br'];
  const platforms = [
    { code:'amazon',  name:'Amazon',      icon:'\u{1F6D2}', color:'#FF9900', desc:'Global e-commerce leader, 21 independent marketplaces', badge:null, badgeColor:null, markets:AMZ_21 },
    { code:'walmart', name:'Walmart',     icon:'\u{1F535}', color:'#0071CE', desc:'Americas retail giant, 3 core markets', badge:null, badgeColor:null, markets:['us','ca','mx'] },
    { code:'wayfair', name:'Wayfair',     icon:'\u{1F3E0}', color:'#7B1FA2', desc:'Home goods vertical, US/CA/UK/IE', badge:null, badgeColor:null, markets:['us','ca','uk','ie'] },
    { code:'tiktok',  name:'TikTok Shop', icon:'\u{1F3B5}', color:'#69C9D0', desc:'Social commerce, 16 markets', badge:null, badgeColor:null, markets:TIKTOK_16 },
    { code:'shopify', name:'Shopify',     icon:'\u{1F7E2}', color:'#96BF48', desc:'Independent store platform, syncs with Amazon markets', badge:'Syncs with Amazon', badgeColor:'#fbbf24', markets:AMZ_21 },
    { code:'ebay',    name:'eBay',        icon:'\u{1F3F7}\uFE0F', color:'#E53238', desc:'Global auction & marketplace, 13 dedicated sites', badge:'Syncs with Amazon', badgeColor:'#fbbf24', markets:EBAY_13 },
    { code:'temu',    name:'Temu',        icon:'\u{1F6CD}\uFE0F', color:'#FF5A00', desc:'Local seller program, 20 markets', badge:'Local Seller Program', badgeColor:'#fbbf24', markets:TEMU_20 },
  ];
  for (const p of platforms) {
    await client.query(
      `INSERT INTO "GlobalPlatform" (id,code,name,icon,color,description,badge,"badgeColor",enabled,"supportedMarketCodes","enabledMarketCodes","createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,true,$8,$8,NOW(),NOW())
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,icon=EXCLUDED.icon,color=EXCLUDED.color,description=EXCLUDED.description,badge=EXCLUDED.badge,"badgeColor"=EXCLUDED."badgeColor","supportedMarketCodes"=EXCLUDED."supportedMarketCodes","enabledMarketCodes"=EXCLUDED."enabledMarketCodes"`,
      [p.code, p.name, p.icon, p.color, p.desc, p.badge, p.badgeColor, p.markets]
    );
  }
  console.log(`[seed]   GlobalPlatform: ${platforms.length} entries`);

  // ── Categories: Google Product Taxonomy → GlobalCategory ──────
  await client.query(`DELETE FROM "LegacyCategoryCodeMapping"`);
  await client.query(`DELETE FROM "CategoryAlias"`);
  await client.query(`DELETE FROM "CategoryPlatformMapping"`);
  await client.query(`DELETE FROM "GlobalCategory" WHERE level = 4`);
  await client.query(`DELETE FROM "GlobalCategory" WHERE level = 3`);
  await client.query(`DELETE FROM "GlobalCategory" WHERE level = 2`);
  await client.query(`DELETE FROM "GlobalCategory" WHERE level = 1`);

  function slugify(text) {
    return text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function toSlug(name) {
    return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // 2.1 Parse Google Taxonomy
  const taxPath = resolve(__dirname, 'data/taxonomy-with-ids.en-US.txt');
  let taxLines;
  try {
    taxLines = readFileSync(taxPath, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  } catch {
    console.log('[seed]   Google taxonomy file not found, aborting category seed');
    taxLines = [];
  }

  const parsedNodes = [];
  const segmentPathGoogleIdMap = {};
  for (const line of taxLines) {
    const match = line.match(/^(\d+)\s+-\s+(.+)$/);
    if (!match) continue;
    const googleId = parseInt(match[1]);
    const fullPath = match[2].trim();
    const segments = fullPath.split(' > ').map(s => s.trim());
    parsedNodes.push({ googleId, segments, fullPath });
    segmentPathGoogleIdMap[fullPath] = googleId;
    for (let i = 0; i < segments.length - 1; i++) {
      const partialPath = segments.slice(0, i + 1).join(' > ');
      if (!segmentPathGoogleIdMap[partialPath]) {
        const partialMatch = taxLines.find(l => {
          const m = l.match(/^(\d+)\s+-\s+(.+)$/);
          return m && m[2].trim() === partialPath;
        });
        if (partialMatch) {
          segmentPathGoogleIdMap[partialPath] = parseInt(partialMatch.match(/^(\d+)/)[1]);
        }
      }
    }
  }
  console.log(`[seed]   Parsed ${parsedNodes.length} Google taxonomy nodes`);

  // 2.2 Filter: Remove 3 non-applicable L1s
  const REMOVE_L1 = new Set(['Mature', 'Religious & Ceremonial', 'Software']);
  const filtered = parsedNodes.filter(n => !REMOVE_L1.has(n.segments[0]));

  // 2.3 Core Subset filtering by L1 density
  const HIGH_DENSITY = new Set([
    'Animals & Pet Supplies', 'Apparel & Accessories', 'Baby & Toddler',
    'Cameras & Optics', 'Electronics', 'Health & Beauty',
    'Home & Garden', 'Sporting Goods', 'Toys & Games'
  ]);
  const MEDIUM_DENSITY = new Set([
    'Arts & Entertainment', 'Business & Industrial', 'Food, Beverages & Tobacco',
    'Furniture', 'Hardware', 'Vehicles & Parts'
  ]);
  const LOW_DENSITY = new Set([
    'Luggage & Bags', 'Media', 'Office Supplies'
  ]);

  const MAX_DEPTH = 4;
  const coreSubset = filtered.filter(n => {
    const l1 = n.segments[0];
    const depth = n.segments.length;
    if (depth > MAX_DEPTH) return false;
    if (HIGH_DENSITY.has(l1)) return true;
    if (MEDIUM_DENSITY.has(l1)) return depth <= 3;
    if (LOW_DENSITY.has(l1)) return depth <= 2;
    return false;
  });
  console.log(`[seed]   After core subset filter: ${coreSubset.length} nodes`);

  // 2.4 Collect truncated leaves for depth_compress aliases
  const truncatedLeaves = [];
  for (const n of filtered) {
    if (n.segments.length > MAX_DEPTH) {
      const parentPath = n.segments.slice(0, MAX_DEPTH).join(' > ');
      truncatedLeaves.push({ leafName: n.segments[n.segments.length - 1], parentPath });
    }
  }

  // 2.5 Build GlobalCategory tree (deduped by fullPath)
  const L1_ICONS = {
    'Animals & Pet Supplies': '\u{1F43E}',
    'Apparel & Accessories': '\u{1F457}',
    'Arts & Entertainment': '\u{1F3A8}',
    'Baby & Toddler': '\u{1F476}',
    'Business & Industrial': '\u{1F3ED}',
    'Cameras & Optics': '\u{1F4F7}',
    'Electronics': '\u26A1',
    'Food, Beverages & Tobacco': '\u{1F6D2}',
    'Furniture': '\u{1FA91}',
    'Hardware': '\u{1F527}',
    'Health & Beauty': '\u{1F48A}',
    'Home & Garden': '\u{1F3E0}',
    'Luggage & Bags': '\u{1F4BC}',
    'Media': '\u{1F4DA}',
    'Office Supplies': '\u{1F4CE}',
    'Sporting Goods': '\u{1F3CB}\uFE0F',
    'Toys & Games': '\u{1F9F8}',
    'Vehicles & Parts': '\u{1F697}',
  };

  const categoryMap = new Map();
  const sortOrderMap = {};

  for (const node of coreSubset) {
    let parentCode = null;
    for (let i = 0; i < node.segments.length; i++) {
      const segment = node.segments[i];
      const code = parentCode ? `${parentCode}__${slugify(segment)}` : slugify(segment);
      if (!categoryMap.has(code)) {
        const partialPath = node.segments.slice(0, i + 1).join(' > ');
        const gId = segmentPathGoogleIdMap[partialPath] || null;
        const parentKey = parentCode || '__ROOT__';
        if (!sortOrderMap[parentKey]) sortOrderMap[parentKey] = 0;
        const sortOrder = sortOrderMap[parentKey]++;
        categoryMap.set(code, {
          code,
          name: segment,
          level: i + 1,
          path: partialPath,
          slugPath: code.split('__').map(s => s.replace(/_/g, '-')).join('/'),
          icon: i === 0 ? (L1_ICONS[segment] || '') : '',
          googleTaxonomyId: gId,
          parentCode,
          source: 'google',
          sortOrder,
        });
      }
      parentCode = code;
    }
  }

  const categories = Array.from(categoryMap.values());
  console.log(`[seed]   GlobalCategory to insert: ${categories.length}`);

  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const c of categories) levelCounts[c.level]++;
  console.log(`[seed]   Level distribution: L1=${levelCounts[1]}, L2=${levelCounts[2]}, L3=${levelCounts[3]}, L4=${levelCounts[4]}`);

  // Insert categories level by level (parents first)
  const codeToDbId = {};
  for (let level = 1; level <= MAX_DEPTH; level++) {
    const levelCats = categories.filter(c => c.level === level);
    for (const c of levelCats) {
      const parentId = c.parentCode ? codeToDbId[c.parentCode] : null;
      const res = await client.query(
        `INSERT INTO "GlobalCategory" (id,code,name,level,icon,tags,enabled,"parentId",path,"slugPath",status,source,"googleTaxonomyId","sortOrder","mappingCount","createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,true,$6,$7,$8,'ACTIVE',$9,$10,$11,0,NOW(),NOW())
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,level=EXCLUDED.level,icon=EXCLUDED.icon,"parentId"=EXCLUDED."parentId",path=EXCLUDED.path,"slugPath"=EXCLUDED."slugPath",source=EXCLUDED.source,"googleTaxonomyId"=EXCLUDED."googleTaxonomyId","sortOrder"=EXCLUDED."sortOrder"
         RETURNING id`,
        [c.code, c.name, c.level, c.icon, [], parentId, c.path, c.slugPath, c.source, c.googleTaxonomyId, c.sortOrder]
      );
      codeToDbId[c.code] = res.rows[0].id;
    }
  }
  console.log(`[seed]   GlobalCategory: ${levelCounts[1]} L1, ${levelCounts[2]} L2, ${levelCounts[3]} L3, ${levelCounts[4]} L4`);

  // ── Warehouses (48) ───────────────────────────────────────
  await client.query(`DELETE FROM "GlobalWarehouse"`);
  const WH = {
    us: [
      { code:'amz_fba_us',    name:'Amazon FBA (USA)',            type:'FBA', nodes:['LAX','JFK','ORD','DFW','ATL','SEA'], desc:'Covers 95% of US, Prime 2-Day' },
      { code:'shipbob_us',    name:'ShipBob',                     type:'3PL', nodes:['LA','PA','IL','TX','AZ','FL'], desc:'DTC preferred, 50+ global sites' },
      { code:'shipmonk_us',   name:'ShipMonk',                    type:'3PL', nodes:['PA','CA','FL','TX'], desc:'Subscription/crowdfunding specialized' },
      { code:'red_stag',      name:'Red Stag Fulfillment',        type:'3PL', nodes:['UT','TN'], desc:'Heavy/bulky goods specialized, 96% 2-Day' },
      { code:'deliverr',      name:'Deliverr (Shopify Logistics)',type:'3PL', nodes:['Distributed US Network'], desc:'Shopify ecosystem preferred' },
      { code:'whiplash_us',   name:'Whiplash (RyderShip)',        type:'3PL', nodes:['CA','NJ','OH','TX'], desc:'Multi-channel DTC+B2B' },
      { code:'shipfusion_us', name:'Shipfusion',                  type:'3PL', nodes:['IL','PA','NV'], desc:'SQF certified, Food/Supplements' },
      { code:'flexport_us',   name:'Flexport Fulfillment',        type:'3PL', nodes:['LA','NJ'], desc:'Freight forwarding + Fulfillment' },
      { code:'dhl_us',        name:'DHL Supply Chain',            type:'3PL', nodes:['Large US Network'], desc:'Largest global 3PL' },
      { code:'ups_scs_us',    name:'UPS Supply Chain Solutions',   type:'3PL', nodes:['US Multi-nodes'], desc:'UPS logistics ecosystem' },
    ],
    eu: [
      { code:'amz_fba_eu',   name:'Amazon FBA Pan-EU',  type:'FBA', nodes:['DE','UK','FR','IT','ES','PL','SE'], desc:'Pan-EU FBA, unified inventory across 7 countries' },
      { code:'shipbob_eu',   name:'ShipBob (Europe)',    type:'3PL', nodes:['UK','DE','NL','PL','ES','IT'], desc:'US 3PL European expansion' },
      { code:'byrd_eu',      name:'Byrd',               type:'3PL', nodes:['DE','AT','NL','FR','IT','UK','ES'], desc:'EU E-commerce 3PL, carbon neutral' },
      { code:'bezos_ai',     name:'Bezos.ai',           type:'3PL', nodes:['UK','DE','FR','IT','NL','PL','ES'], desc:'Emerging EU 3PL, EORI/IOSS support' },
      { code:'radial_eu',    name:'Radial Europe',      type:'3PL', nodes:['DE','IT','NL','PL','BE','UK'], desc:'Enterprise EU fulfillment' },
      { code:'omnipack',     name:'Omnipack',           type:'3PL', nodes:['PL'], desc:'Poland central hub, 1-day to Germany' },
      { code:'wapi_eu',      name:'WAPI',               type:'3PL', nodes:['PL','DE','IT','ES','HU','RO','SK','UK'], desc:'Eastern EU low-cost network' },
      { code:'huboo_eu',     name:'Huboo',              type:'3PL', nodes:['UK','NL','DE','ES'], desc:'SME friendly, Hub manager model' },
      { code:'salesupply_eu',name:'Salesupply',          type:'3PL', nodes:['DE','FR','NL','UK','IT','ES','PL','DK','SE'], desc:'Returns+CS+Fulfillment integrated' },
      { code:'dhl_eu',       name:'DHL Fulfillment',     type:'3PL', nodes:['DE','FR','NL'], desc:'Largest EU logistics network' },
      { code:'octopia_eu',   name:'Octopia (Cdiscount)', type:'3PL', nodes:['FR Multi-nodes'], desc:'France + 20 EU countries' },
    ],
    uk: [
      { code:'amz_fba_uk',  name:'Amazon FBA (UK)',    type:'FBA', nodes:['LTN','MAN','LBA','BHX','EDI'], desc:'UK Local FBA, Prime Next-day' },
      { code:'shipbob_uk',  name:'ShipBob (UK)',       type:'3PL', nodes:['London/Birmingham'], desc:'US 3PL UK nodes' },
      { code:'zendbox',     name:'Zendbox',            type:'3PL', nodes:['Central England'], desc:'UK Local 3PL, Same-day/Next-day' },
      { code:'huboo_uk',    name:'Huboo UK',           type:'3PL', nodes:['Bristol'], desc:'Micro-hub model, low barrier for SME' },
      { code:'bigblue_uk',  name:'Bigblue',            type:'3PL', nodes:['London Area'], desc:'EU+UK Omnichannel Fulfillment' },
      { code:'walker_uk',   name:'Walker Logistics',   type:'3PL', nodes:['Oxfordshire'], desc:'UK+EU dual nodes' },
      { code:'mango_uk',    name:'Mango Logistics',    type:'3PL', nodes:['England'], desc:'Amazon seller background, Brexit compliant' },
      { code:'launch_uk',   name:'Launch Fulfillment',  type:'3PL', nodes:['Seaham'], desc:'US-UK dual nodes, Same-day dispatch' },
    ],
    jp: [
      { code:'amz_fba_jp',  name:'Amazon FBA (Japan)',   type:'FBA', nodes:['NRT','KIX','NGO','CTS'], desc:'Japan Local FBA, Prime Next-day' },
      { code:'nippon_exp',  name:'Nippon Express',       type:'3PL', nodes:['Tokyo','Osaka','Nagoya','Fukuoka','Sapporo'], desc:'Largest JP 3PL, Global 164 countries' },
      { code:'yamato_logi', name:'Yamato Logistics',     type:'3PL', nodes:['All 47 Prefectures'], desc:'Yamato Transport group, small parcel experts' },
      { code:'sagawa',      name:'Sagawa Express',       type:'3PL', nodes:['29 Countries Network'], desc:'B2B+B2C, International freight' },
      { code:'logisteed',   name:'LOGISTEED',            type:'3PL', nodes:['Tokyo','Osaka','Nagoya'], desc:'Hitachi integrated, High precision' },
      { code:'openlogi',    name:'OpenLogi',             type:'3PL', nodes:['Tokyo','Osaka'], desc:'SaaS Warehouse, Shopify/Rakuten' },
      { code:'mitsui_soko', name:'Mitsui-Soko',          type:'3PL', nodes:['Tokyo','Osaka','Nagoya','Fukuoka'], desc:'Customs + warehousing integrated' },
      { code:'kintetsu_we', name:'Kintetsu World Express',type:'3PL', nodes:['Narita','Osaka','Nagoya'], desc:'APAC cross-border, Air freight' },
      { code:'ezbuy_jp',    name:'Ezbuy Japan',          type:'3PL', nodes:['Tokyo','Osaka'], desc:'Cross-border seller localization' },
      { code:'omni_jp',     name:'Omni Logistics (Japan)',type:'3PL', nodes:['Tokyo','Osaka'], desc:'Exhibition/project freight' },
    ],
    ca: [
      { code:'amz_fba_ca',    name:'Amazon FBA (Canada)',  type:'FBA', nodes:['YVR','YYZ','YUL'], desc:'Canada local FBA, Prime 2-Day' },
      { code:'shipbob_ca',    name:'ShipBob (Canada)',     type:'3PL', nodes:['ON','BC'], desc:'US-CA Seamless Cross-border' },
      { code:'shipmonk_ca',   name:'ShipMonk (Canada)',    type:'3PL', nodes:['ON'], desc:'Tech-driven, Subscription/DTC' },
      { code:'shipfusion_ca', name:'Shipfusion (Canada)',  type:'3PL', nodes:['ON'], desc:'Health Canada Certified' },
      { code:'amzprep_ca',    name:'AMZ Prep',             type:'3PL', nodes:['BC','ON','AB'], desc:'Amazon FBA Prep specialized' },
      { code:'ecomlogistics',  name:'Ecom Logistics',      type:'3PL', nodes:['ON','QC','BC'], desc:'CA local preferred, 500+ fleets' },
      { code:'stallion_ca',   name:'Stallion Express',     type:'3PL', nodes:['ON','BC','AB','QC'], desc:'Low-cost cross-border US-CA' },
      { code:'sfi_ca',        name:'Strader Ferris Int\'l',type:'3PL', nodes:['ON','BC'], desc:'US-CA Customs broker + Logistics' },
      { code:'dhl_ca',        name:'DHL Supply Chain (CA)',type:'3PL', nodes:['Toronto','Vancouver','Montreal'], desc:'Global network Canada nodes' },
    ],
  };

  let whCount = 0;
  for (const [region, whs] of Object.entries(WH)) {
    for (const w of whs) {
      await client.query(
        `INSERT INTO "GlobalWarehouse" (id,code,name,type,region,country,nodes,description,enabled,"createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW())
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,region=EXCLUDED.region,nodes=EXCLUDED.nodes,description=EXCLUDED.description`,
        [w.code, w.name, w.type, region, region.toUpperCase(), w.nodes, w.desc]
      );
      whCount++;
    }
  }
  console.log(`[seed]   GlobalWarehouse: ${whCount} entries`);

  // ── ERP Systems (4) ───────────────────────────────────────
  const erpSystems = [
    { code:'sap', name:'SAP Business One', vendor:'SAP', icon:'\u{1F4BC}', desc:'Enterprise ERP, multi-book, multi-currency support' },
    { code:'kingdee', name:'Kingdee Cloud', vendor:'Kingdee', icon:'\u{1F52E}', desc:'Mainstream ERP in APAC, financial supply chain integrated' },
    { code:'yonyou', name:'Yonyou U8+', vendor:'Yonyou', icon:'\u{1F4CA}', desc:'Yonyou flagship ERP product' },
    { code:'netsuite', name:'NetSuite', vendor:'Oracle', icon:'\u2601\uFE0F', desc:'Cloud ERP, suitable for multinationals' },
  ];
  for (const e of erpSystems) {
    await client.query(
      `INSERT INTO "GlobalErpSystem" (id,code,name,vendor,icon,description,enabled,"createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,true,NOW(),NOW())
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,vendor=EXCLUDED.vendor,icon=EXCLUDED.icon,description=EXCLUDED.description`,
      [e.code, e.name, e.vendor, e.icon, e.desc]
    );
  }
  console.log(`[seed]   GlobalErpSystem: ${erpSystems.length} entries`);

  // ── Tools (6) ─────────────────────────────────────────────
  const tools = [
    { code:'keepa', name:'Keepa', category:'Data Analytics', icon:'\u{1F4C8}', desc:'Amazon price history tracking, competitor analysis' },
    { code:'h10', name:'Helium 10', category:'Operations', icon:'\u{1F3AF}', desc:'Keyword research, competitor analysis, listing optimization' },
    { code:'js', name:'Jungle Scout', category:'Product Research', icon:'\u{1F50D}', desc:'Amazon product research and market analysis' },
    { code:'dd', name:'DataDive', category:'Data Analytics', icon:'\u{1F93F}', desc:'Deep keyword analysis tool' },
    { code:'ca', name:'ChannelAdvisor', category:'Multi-Channel', icon:'\u{1F517}', desc:'Multi-platform e-commerce management integration' },
    { code:'shipbob', name:'ShipBob', category:'Logistics', icon:'\u{1F4E6}', desc:'Global fulfillment network software' },
  ];
  for (const t of tools) {
    await client.query(
      `INSERT INTO "GlobalTool" (id,code,name,category,icon,description,enabled,"createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,true,NOW(),NOW())
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,icon=EXCLUDED.icon,description=EXCLUDED.description`,
      [t.code, t.name, t.category, t.icon, t.desc]
    );
  }
  console.log(`[seed]   GlobalTool: ${tools.length} entries`);

  // ── Google Product Taxonomy → PlatformCategory ──────────
  await client.query(`DELETE FROM "PlatformCategory" WHERE platform='GOOGLE'`);

  const googleParentMap = {};
  let googleCount = 0;
  for (const line of taxLines) {
    const match = line.match(/^(\d+)\s+-\s+(.+)$/);
    if (!match) continue;
    const catId = match[1];
    const fullPath = match[2].trim();
    const parts = fullPath.split(' > ');
    const level = parts.length;
    if (level > 4) continue;
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join(' > ');
    const parentDbId = parentPath ? googleParentMap[parentPath] : null;

    const res = await client.query(
      `INSERT INTO "PlatformCategory" (id,platform,"platformCategoryId",name,path,level,"parentId","createdAt","updatedAt")
       VALUES (gen_random_uuid(),'GOOGLE',$1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT (platform,"platformCategoryId","marketCode") DO UPDATE SET name=EXCLUDED.name,path=EXCLUDED.path,level=EXCLUDED.level,"parentId"=EXCLUDED."parentId"
       RETURNING id`,
      [catId, name, fullPath, level, parentDbId]
    );
    googleParentMap[fullPath] = res.rows[0].id;
    googleCount++;
  }
  console.log(`[seed]   PlatformCategory (GOOGLE): ${googleCount} entries (maxDepth=4)`);

  // ── CategoryAlias (auto-generated from Google taxonomy) ─────────
  const KNOWN_ABBREVIATIONS = {
    'Television': 'TV', 'Personal Computer': 'PC', 'Heating, Ventilation & Air Conditioning': 'HVAC',
    'Light-Emitting Diode': 'LED', 'Universal Serial Bus': 'USB', 'Digital Single-Lens Reflex': 'DSLR',
  };

  const ZH_TRANSLATIONS = {
    'Electronics': '电子产品', 'Computers': '电脑', 'Laptops': '笔记本电脑',
    'Mobile Phones': '手机', 'Tablets': '平板电脑', 'Cameras': '相机',
    'Headphones': '耳机', 'Speakers': '音箱', 'Televisions': '电视',
    'Video Game Consoles': '游戏机', 'Wearable Technology': '可穿戴设备',
    'Home & Garden': '家居与园艺', 'Kitchen & Dining': '厨房与餐饮',
    'Furniture': '家具', 'Bedding': '床上用品', 'Lighting': '照明',
    'Bathroom Accessories': '浴室配件', 'Cleaning Supplies': '清洁用品',
    'Apparel & Accessories': '服饰配件', 'Clothing': '服装', 'Shoes': '鞋子',
    'Jewelry': '珠宝', 'Handbags': '手提包', 'Watches': '手表',
    'Health & Beauty': '健康与美容', 'Skin Care': '护肤', 'Hair Care': '护发',
    'Makeup': '化妆品', 'Vitamins & Supplements': '维生素与补充剂',
    'Sporting Goods': '体育用品', 'Exercise & Fitness': '健身',
    'Outdoor Recreation': '户外休闲', 'Cycling': '骑行', 'Water Sports': '水上运动',
    'Toys & Games': '玩具与游戏', 'Dolls & Accessories': '娃娃与配件',
    'Building Toys': '积木玩具', 'Puzzles': '拼图', 'Board Games': '桌游',
    'Animals & Pet Supplies': '宠物用品', 'Dog Supplies': '狗狗用品', 'Cat Supplies': '猫咪用品',
    'Pet Food': '宠物食品', 'Baby & Toddler': '母婴', 'Diapers': '尿布',
    'Baby Toys': '婴儿玩具', 'Baby Transport': '婴儿车',
    'Food, Beverages & Tobacco': '食品饮料', 'Snacks': '零食', 'Beverages': '饮料',
    'Coffee': '咖啡', 'Tea': '茶', 'Condiments & Sauces': '调味品',
    'Office Supplies': '办公用品', 'Arts & Entertainment': '艺术与娱乐',
    'Musical Instruments': '乐器', 'Cameras & Optics': '相机与光学',
    'Hardware': '五金', 'Power Tools': '电动工具', 'Hand Tools': '手动工具',
    'Vehicles & Parts': '汽车与零件', 'Motor Vehicle Parts': '汽车零件',
    'Luggage & Bags': '箱包', 'Business & Industrial': '商业与工业',
    'Media': '媒体', 'Books': '书籍', 'Music & Sound Recordings': '音乐',
    'Desktops': '台式电脑', 'Monitors': '显示器', 'Printers': '打印机',
    'Networking': '网络设备', 'Cell Phone Accessories': '手机配件',
    'Audio Accessories': '音频配件', 'Bags & Cases': '包与壳',
    'Backpacks': '背包', 'Sunglasses': '太阳镜', 'Hats': '帽子',
    'Scarves & Shawls': '围巾与披肩', 'Belts': '腰带',
    'Fragrance': '香水', 'Nail Care': '美甲', 'Oral Care': '口腔护理',
    'Bath & Body': '沐浴与身体护理', 'Shaving & Grooming': '剃须与美容',
    'Fishing': '钓鱼', 'Golf': '高尔夫', 'Tennis': '网球',
    'Swimming': '游泳', 'Running': '跑步',
    'Action Figures': '人偶', 'Stuffed Animals': '毛绒玩具',
    'Bird Supplies': '鸟用品', 'Fish Supplies': '鱼用品',
    'Baby Safety': '婴儿安全', 'Nursing & Feeding': '哺乳与喂养',
    'Strollers': '婴儿推车',
  };

  const aliasSet = new Set();
  let aliasCount = 0;

  async function insertAlias(gcId, alias, language, aliasType, source, weight) {
    const key = `${gcId}|${alias.toLowerCase()}|${language}`;
    if (aliasSet.has(key)) return;
    aliasSet.add(key);
    await client.query(
      `INSERT INTO "CategoryAlias" (id,"globalCategoryId",alias,language,"aliasType",source,weight,"createdAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT ("globalCategoryId",alias,language) DO NOTHING`,
      [gcId, alias, language, aliasType, source, weight]
    );
    aliasCount++;
  }

  for (const c of categories) {
    const gcId = codeToDbId[c.code];
    if (!gcId) continue;
    const nameLower = c.name.toLowerCase();

    // synonym: original name lowercase
    await insertAlias(gcId, nameLower, 'en', 'synonym', 'seed', 1.0);

    // singular: remove trailing 's'
    if (nameLower.endsWith('s') && !nameLower.endsWith('ss') && nameLower.length > 3) {
      await insertAlias(gcId, nameLower.slice(0, -1), 'en', 'singular', 'seed', 0.8);
    }

    // '&' → 'and' variant
    if (c.name.includes('&')) {
      await insertAlias(gcId, nameLower.replace(/&/g, 'and'), 'en', 'synonym', 'seed', 0.8);
    }

    // abbreviation
    for (const [fullName, abbr] of Object.entries(KNOWN_ABBREVIATIONS)) {
      if (c.name.includes(fullName)) {
        await insertAlias(gcId, abbr.toLowerCase(), 'en', 'abbreviation', 'seed', 0.7);
      }
    }

    // Chinese translation
    if (ZH_TRANSLATIONS[c.name]) {
      await insertAlias(gcId, ZH_TRANSLATIONS[c.name], 'zh', 'translation', 'seed', 1.0);
    }
  }

  // depth_compress aliases: truncated leaves
  for (const leaf of truncatedLeaves) {
    const parentCode = Array.from(categoryMap.values()).find(c => c.path === leaf.parentPath)?.code;
    if (parentCode && codeToDbId[parentCode]) {
      await insertAlias(codeToDbId[parentCode], leaf.leafName.toLowerCase(), 'en', 'depth_compress', 'seed', 0.7);
    }
  }
  console.log(`[seed]   CategoryAlias: ${aliasCount} entries`);

  // ── Legacy Code Mapping (old Amazon codes → new Google codes) ──
  const OLD_CODES = {};
  const oldCatRes = await client.query(`SELECT code FROM "GlobalCategory" WHERE source = 'manual'`);
  // Since we just replaced all with google source, build mapping from known old codes
  const LEGACY_MAP = {
    'electronics': 'electronics',
    'cell_phones': 'electronics__communications__telephony__mobile_phones',
    'computers': 'electronics__computers',
    'tv_video': 'electronics__video',
    'camera': 'cameras_and_optics',
    'audio': 'electronics__audio',
    'smart_home': 'electronics__electronics_accessories__home_automation',
    'wearable': 'electronics__electronics_accessories__wearable_technology',
    'gaming': 'electronics__video_game_consoles_and_video_games',
    'home_kitchen': 'home_and_garden',
    'kitchen_dining': 'home_and_garden__kitchen_and_dining',
    'bedding': 'home_and_garden__linens_and_bedding__bedding',
    'bath': 'home_and_garden__bathroom_accessories',
    'furniture': 'furniture',
    'storage': 'home_and_garden__household_supplies__storage_and_organization',
    'lighting': 'home_and_garden__lighting',
    'decor': 'home_and_garden__decor',
    'cleaning': 'home_and_garden__household_supplies__household_cleaning_supplies',
    'sports': 'sporting_goods',
    'fitness': 'sporting_goods__exercise_and_fitness',
    'outdoor': 'sporting_goods__outdoor_recreation',
    'cycling': 'sporting_goods__outdoor_recreation__cycling',
    'beauty': 'health_and_beauty',
    'skincare': 'health_and_beauty__skin_care',
    'makeup': 'health_and_beauty__makeup',
    'hair_care': 'health_and_beauty__hair_care',
    'fragrance': 'health_and_beauty__fragrance',
    'personal_care': 'health_and_beauty__personal_care',
    'toys': 'toys_and_games',
    'action_figures': 'toys_and_games__toys__action_figures',
    'building_toys': 'toys_and_games__toys__building_toys',
    'dolls': 'toys_and_games__toys__dolls_and_accessories',
    'board_games': 'toys_and_games__games__board_games',
    'pet': 'animals_and_pet_supplies__pet_supplies',
    'dog': 'animals_and_pet_supplies__pet_supplies__dog_supplies',
    'cat': 'animals_and_pet_supplies__pet_supplies__cat_supplies',
    'tools': 'hardware',
    'power_tools': 'hardware__power_tools',
    'hand_tools': 'hardware__hand_tools',
    'clothing': 'apparel_and_accessories',
    'shoes': 'apparel_and_accessories__shoes',
    'bags': 'luggage_and_bags',
    'jewelry': 'apparel_and_accessories__jewelry',
    'health': 'health_and_beauty',
    'vitamins': 'health_and_beauty__vitamins_and_supplements',
    'grocery': 'food_beverages_and_tobacco',
    'snacks': 'food_beverages_and_tobacco__food_items__snack_foods',
    'beverages': 'food_beverages_and_tobacco__beverages',
    'office': 'office_supplies',
    'office_supplies': 'office_supplies',
    'auto': 'vehicles_and_parts',
    'car_electronics': 'vehicles_and_parts__vehicle_parts_and_accessories__motor_vehicle_electronics',
    'books': 'media__books',
    'music': 'arts_and_entertainment__hobbies_and_creative_arts__musical_instrument_and_orchestra_accessories',
    'garden_patio': 'home_and_garden__lawn_and_garden',
  };

  let legacyCount = 0;
  for (const [oldCode, newCode] of Object.entries(LEGACY_MAP)) {
    const validNew = categoryMap.has(newCode);
    await client.query(
      `INSERT INTO "LegacyCategoryCodeMapping" (id,"oldCode","newCode",note)
       VALUES (gen_random_uuid(),$1,$2,$3)
       ON CONFLICT ("oldCode") DO UPDATE SET "newCode"=EXCLUDED."newCode",note=EXCLUDED.note`,
      [oldCode, validNew ? newCode : '', validNew ? null : 'MANUAL_REVIEW']
    );
    legacyCount++;
  }
  // Also add region-specific old codes that map to nothing
  for (const regionCode of ['jp_unique','in_unique','ae_unique','ca_unique']) {
    await client.query(
      `INSERT INTO "LegacyCategoryCodeMapping" (id,"oldCode","newCode",note)
       VALUES (gen_random_uuid(),$1,'','REMOVED_REGION_CATEGORY')
       ON CONFLICT ("oldCode") DO UPDATE SET "newCode"=EXCLUDED."newCode",note=EXCLUDED.note`,
      [regionCode]
    );
    legacyCount++;
  }
  console.log(`[seed]   LegacyCategoryCodeMapping: ${legacyCount} entries`);

  // ── CategoryPlatformMapping (GlobalCategory ↔ PlatformCategory GOOGLE) ──
  let mappingCount = 0;
  for (const c of categories) {
    const gcDbId = codeToDbId[c.code];
    if (!gcDbId || !c.googleTaxonomyId) continue;
    const gTaxId = String(c.googleTaxonomyId);
    const pcDbId = googleParentMap[c.path];
    if (!pcDbId) continue;
    await client.query(
      `INSERT INTO "CategoryPlatformMapping" (id,"globalCategoryId",platform,"marketCode","platformCategoryId","mappingType","confidenceScore",direction,source,status,"createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,'GOOGLE','GLOBAL',$2,'EXACT',1.0,'BIDIRECTIONAL','seed','ACTIVE',NOW(),NOW())
       ON CONFLICT ("globalCategoryId","platformCategoryId","marketCode") DO NOTHING`,
      [gcDbId, pcDbId]
    );
    mappingCount++;
  }
  // Update mappingCount on GlobalCategory
  await client.query(`
    UPDATE "GlobalCategory" g
    SET "mappingCount" = (
      SELECT COUNT(*) FROM "CategoryPlatformMapping" m WHERE m."globalCategoryId" = g.id
    )
  `);
  console.log(`[seed]   CategoryPlatformMapping (GOOGLE): ${mappingCount} entries`);

  console.log('[seed] global registry seeded successfully');
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO "Tenant" (id, name, code, status, "createdAt", "updatedAt")
       VALUES ('00000000-0000-0000-0000-000000000000', 'System Platform', 'system', 'active', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`
    );
    console.log('[seed] system tenant: 00000000-0000-0000-0000-000000000000');

    const tenantRes = await client.query(
      `INSERT INTO "Tenant" (id, name, code, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'Global Tech Corp', 'globaltech', 'active', NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const tenantId = tenantRes.rows[0].id;
    console.log(`[seed] tenant: ${tenantId}`);

    const users = [
      { email: 'admin@system.io',     name: 'System Admin',  role: 'system_admin' },
      { email: 'boss@globaltech.com', name: 'Tenant Admin',  role: 'tenant_admin' },
      { email: 'ops@globaltech.com',  name: 'Operator',      role: 'operator' },
      { email: 'factory@supplier.cn', name: 'Supplier',      role: 'supplier' },
      { email: 'investor@vc.com',     name: 'Viewer',        role: 'viewer' },
    ];

    const password = 'harness123';

    for (const u of users) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);
      const passwordHash = `${salt}:${hash}`;

      await client.query(
        `INSERT INTO "User" (id, email, name, role, "tenantId", "passwordHash", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash"`,
        [u.email, u.name, u.role, tenantId, passwordHash]
      );
      console.log(`[seed] upserted user: ${u.email} (${u.role})`);
    }

    console.log('[seed] done (users)');

    await seedGlobalRegistry(client);

    console.log('[seed] all done');
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => pool.end());
