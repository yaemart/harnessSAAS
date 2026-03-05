import crypto from 'node:crypto';
import { prisma } from './db.js';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_ID_2 = '22222222-2222-2222-2222-222222222222';

async function main() {
  console.log('=== Harness Full Seed ===\n');

  // 1. Tenants
  console.log('[1/9] Creating tenants...');
  const tenant1 = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, code: 'global-tech', name: 'Global Tech Corp', status: 'active' },
  });
  const tenant2 = await prisma.tenant.upsert({
    where: { id: TENANT_ID_2 },
    update: {},
    create: { id: TENANT_ID_2, code: 'alpha-ecom', name: 'Alpha E-Commerce', status: 'active' },
  });
  console.log(`  ✓ ${tenant1.name}, ${tenant2.name}`);

  // 2. Users (5 roles)
  console.log('[2/9] Creating users (5 roles)...');
  const defaultPw = hashPassword('harness123');
  const users = [
    { email: 'admin@system.io', name: 'System Admin', role: 'system_admin', tenantId: TENANT_ID },
    { email: 'boss@globaltech.com', name: 'Tenant Admin', role: 'tenant_admin', tenantId: TENANT_ID },
    { email: 'ops@globaltech.com', name: 'Operator Zhang', role: 'operator', tenantId: TENANT_ID },
    { email: 'factory@supplier.cn', name: 'Supplier Wang', role: 'supplier', tenantId: TENANT_ID },
    { email: 'investor@vc.com', name: 'Viewer Li', role: 'viewer', tenantId: TENANT_ID },
    { email: 'ops2@alpha.com', name: 'Alpha Operator', role: 'operator', tenantId: TENANT_ID_2 },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash: defaultPw },
      create: { ...u, passwordHash: defaultPw, isActive: true },
    });
  }
  console.log(`  ✓ ${users.length} users (password: harness123)`);

  // 3. Categories
  console.log('[3/9] Creating categories...');
  const catElectronics = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'electronics' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'electronics', name: 'Electronics', definition: 'Consumer electronics and accessories' },
  });
  const catKitchen = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'kitchen' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'kitchen', name: 'Kitchen & Dining', definition: 'Kitchen appliances and dining products' },
  });
  const catCoffee = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'coffee-machines' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'coffee-machines', name: 'Coffee Machines', definition: 'Coffee brewing devices', parentId: catKitchen.id },
  });
  console.log(`  ✓ ${catElectronics.name}, ${catKitchen.name}, ${catCoffee.name}`);

  // 4. Brands
  console.log('[4/9] Creating brands...');
  const brandAcme = await prisma.brand.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'ACME' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'ACME', name: 'Acme Coffee Co.', description: 'Premium coffee makers and accessories' },
  });
  const brandElectra = await prisma.brand.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'ELECTRA' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'ELECTRA', name: 'Electra Kitchen', description: 'Modern smart kitchen appliances' },
  });
  console.log(`  ✓ ${brandAcme.name}, ${brandElectra.name}`);

  // 5. Supplier
  console.log('[5/9] Creating suppliers...');
  const supplier = await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'SUP-DG-01' } },
    update: {},
    create: {
      tenantId: TENANT_ID, code: 'SUP-DG-01', name: '东莞精密电子有限公司',
      contactName: 'Wang Factory', contactEmail: 'factory@supplier.cn',
      leadTimeDays: 14, moq: 500, currency: 'CNY', country: 'CN',
    },
  });
  console.log(`  ✓ ${supplier.name}`);

  // 6. Markets + Platforms
  console.log('[6/9] Creating markets & platforms...');
  const marketUS = await prisma.market.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'US' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York' },
  });
  const marketDE = await prisma.market.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'DE' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'DE', name: 'Germany', currency: 'EUR', timezone: 'Europe/Berlin' },
  });
  const marketJP = await prisma.market.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'JP' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'JP', name: 'Japan', currency: 'JPY', timezone: 'Asia/Tokyo' },
  });

  const platAmazonUS = await prisma.platform.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'amazon-us' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'amazon-us', name: 'Amazon US', apiType: 'SP-API', apiStatus: 'connected' },
  });
  const platAmazonDE = await prisma.platform.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'amazon-de' } },
    update: {},
    create: { tenantId: TENANT_ID, code: 'amazon-de', name: 'Amazon DE', apiType: 'SP-API', apiStatus: 'connected' },
  });
  console.log(`  ✓ Markets: US, DE, JP | Platforms: Amazon US, Amazon DE`);

  // 7. Products + Commodities + Listings + Performance
  console.log('[7/9] Creating products, commodities, listings, performance...');
  const products = [
    { sku: 'PRD-AERO-001', name: 'AeroPress Coffee Maker', brand: brandAcme, category: catCoffee, cost: 12.50, msrp: 39.99, lifecycle: 'MATURE', asin: 'B0047BIWSK' },
    { sku: 'PRD-GRIND-002', name: 'Electra Smart Grinder Pro', brand: brandElectra, category: catCoffee, cost: 28.00, msrp: 89.99, lifecycle: 'GROWTH', asin: 'B08NX2C4GN' },
    { sku: 'PRD-KETTLE-003', name: 'Electra Gooseneck Kettle', brand: brandElectra, category: catKitchen, cost: 15.00, msrp: 49.99, lifecycle: 'LAUNCH', asin: 'B09KZQR1M4' },
    { sku: 'PRD-SCALE-004', name: 'Acme Precision Scale', brand: brandAcme, category: catCoffee, cost: 8.00, msrp: 29.99, lifecycle: 'DECLINE', asin: 'B07JG1PXLC' },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: TENANT_ID, sku: p.sku } },
      update: {},
      create: {
        tenantId: TENANT_ID, brandId: p.brand.id, categoryId: p.category.id,
        supplierId: supplier.id, sku: p.sku, name: p.name,
        lifecycleStage: p.lifecycle, asin: p.asin,
        costPrice: p.cost, msrp: p.msrp,
      },
    });

    const commodity = await prisma.commodity.upsert({
      where: { productId_marketId_language: { productId: product.id, marketId: marketUS.id, language: 'en' } },
      update: {},
      create: {
        tenantId: TENANT_ID, productId: product.id, marketId: marketUS.id,
        language: 'en', title: `${p.name} - US`, lifecycleStage: p.lifecycle,
      },
    });

    const listing = await prisma.listing.upsert({
      where: { platformId_externalListingId: { platformId: platAmazonUS.id, externalListingId: p.asin } },
      update: {},
      create: {
        tenantId: TENANT_ID, commodityId: commodity.id, platformId: platAmazonUS.id,
        externalListingId: p.asin, title: p.name, status: 'ACTIVE', isPrimary: true,
        origin: 'platform_import', mappingStatus: 'mapped',
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const roas = p.lifecycle === 'MATURE' ? 4.2 : p.lifecycle === 'GROWTH' ? 3.1 : p.lifecycle === 'LAUNCH' ? 1.8 : 1.2;
    const impressions = p.lifecycle === 'MATURE' ? 15000 : p.lifecycle === 'GROWTH' ? 8000 : 3000;
    const clicks = Math.round(impressions * 0.03);
    const orders = Math.round(clicks * 0.12);
    const spend = Math.round(clicks * 1.2 * 100) / 100;
    const sales = Math.round(spend * roas * 100) / 100;

    await prisma.performanceSnapshot.upsert({
      where: { listingId_snapshotDate: { listingId: listing.id, snapshotDate: today } },
      update: {},
      create: {
        tenantId: TENANT_ID, productId: product.id, commodityId: commodity.id,
        listingId: listing.id, platform: 'amazon-us', market: 'US',
        brand: p.brand.name, category: p.category.name, fulfillment: 'FBA',
        snapshotDate: today, impressions, clicks, spend, sales, orders,
        normalizedRoas: roas,
      },
    });
  }
  console.log(`  ✓ ${products.length} products with listings & performance`);

  // 8. User Scopes
  console.log('[8/9] Creating user scopes...');
  const operatorUser = await prisma.user.findUnique({ where: { email: 'ops@globaltech.com' } });
  const supplierUser = await prisma.user.findUnique({ where: { email: 'factory@supplier.cn' } });
  if (operatorUser) {
    await prisma.userScope.upsert({
      where: { userId_tenantId_scopeType_scopeValue: { userId: operatorUser.id, tenantId: TENANT_ID, scopeType: 'brand', scopeValue: brandAcme.id } },
      update: {},
      create: { userId: operatorUser.id, tenantId: TENANT_ID, scopeType: 'brand', scopeValue: brandAcme.id },
    });
    await prisma.userScope.upsert({
      where: { userId_tenantId_scopeType_scopeValue: { userId: operatorUser.id, tenantId: TENANT_ID, scopeType: 'brand', scopeValue: brandElectra.id } },
      update: {},
      create: { userId: operatorUser.id, tenantId: TENANT_ID, scopeType: 'brand', scopeValue: brandElectra.id },
    });
  }
  if (supplierUser) {
    await prisma.userScope.upsert({
      where: { userId_tenantId_scopeType_scopeValue: { userId: supplierUser.id, tenantId: TENANT_ID, scopeType: 'brand', scopeValue: brandAcme.id } },
      update: {},
      create: { userId: supplierUser.id, tenantId: TENANT_ID, scopeType: 'brand', scopeValue: brandAcme.id },
    });
  }
  console.log(`  ✓ Operator: 2 brand scopes, Supplier: 1 brand scope`);

  // 9. Knowledge Layer A (Public Knowledge)
  console.log('[9/9] Creating public knowledge & industry benchmarks...');
  await prisma.knowledgeLayerA.upsert({
    where: { domain_key: { domain: 'platform_rules', key: 'amazon-fba-fee-schedule' } },
    update: {},
    create: {
      domain: 'platform_rules', key: 'amazon-fba-fee-schedule',
      title: 'Amazon FBA Fee Schedule 2026',
      content: { smallStandard: 3.22, largeStandard: 5.26, smallOversize: 9.73, mediumOversize: 19.05, effectiveDate: '2026-01-15' },
      source: 'manual', version: 1, requiresDualApproval: true, approvedBy: ['admin@system.io', 'boss@globaltech.com'], isActive: true,
    },
  });
  await prisma.knowledgeLayerA.upsert({
    where: { domain_key: { domain: 'seasonal_trends', key: 'q4-holiday-calendar' } },
    update: {},
    create: {
      domain: 'seasonal_trends', key: 'q4-holiday-calendar',
      title: 'Q4 Holiday Calendar & Demand Multipliers',
      content: { blackFriday: { date: '2026-11-27', demandMultiplier: 3.5 }, cyberMonday: { date: '2026-11-30', demandMultiplier: 2.8 }, christmas: { date: '2026-12-25', demandMultiplier: 2.0 } },
      source: 'manual', version: 1, requiresDualApproval: true, approvedBy: ['admin@system.io'], isActive: false,
    },
  });

  const benchmarkPeriodStart = new Date('2026-01-01');
  const benchmarkPeriodEnd = new Date('2026-03-01');
  const benchmarks = [
    { industryCategory: 'kitchen-appliances', metricKey: 'avg_acos', metricValue: 0.22, sampleSize: 150, contributingTenants: 12 },
    { industryCategory: 'kitchen-appliances', metricKey: 'avg_roas', metricValue: 3.8, sampleSize: 150, contributingTenants: 12 },
    { industryCategory: 'kitchen-appliances', metricKey: 'avg_return_rate', metricValue: 0.045, sampleSize: 120, contributingTenants: 8 },
    { industryCategory: 'coffee-equipment', metricKey: 'avg_acos', metricValue: 0.18, sampleSize: 80, contributingTenants: 6 },
    { industryCategory: 'coffee-equipment', metricKey: 'avg_roas', metricValue: 4.5, sampleSize: 80, contributingTenants: 6 },
  ];
  for (const b of benchmarks) {
    await prisma.knowledgeLayerB.upsert({
      where: { industryCategory_metricKey_periodStart: { industryCategory: b.industryCategory, metricKey: b.metricKey, periodStart: benchmarkPeriodStart } },
      update: {},
      create: { ...b, periodStart: benchmarkPeriodStart, periodEnd: benchmarkPeriodEnd },
    });
  }
  console.log(`  ✓ 2 public knowledge entries, ${benchmarks.length} industry benchmarks`);

  // 10. Portal: BrandPortalConfig + ConsumerFAQ + CommodityMedia
  console.log('[10/10] Creating portal data...');

  await prisma.brandPortalConfig.upsert({
    where: { brandId: brandAcme.id },
    update: {},
    create: {
      tenantId: TENANT_ID,
      brandId: brandAcme.id,
      customDomain: 'support.acmecoffee.com',
      themeId: 'editorial',
      logoUrl: '/images/acme-logo.svg',
      seoTitle: 'Acme Coffee Co. Support',
      seoDescription: 'Get help with your Acme Coffee products — warranty, manuals, and support.',
      welcomeMessage: 'Welcome to Acme Coffee Support. How can we help you today?',
      supportEmail: 'support@acmecoffee.com',
      isActive: true,
    },
  });

  await prisma.brandPortalConfig.upsert({
    where: { brandId: brandElectra.id },
    update: {},
    create: {
      tenantId: TENANT_ID,
      brandId: brandElectra.id,
      customDomain: 'help.electrakitchen.com',
      themeId: 'tech-neon',
      logoUrl: '/images/electra-logo.svg',
      seoTitle: 'Electra Kitchen Support',
      seoDescription: 'Smart kitchen support — setup guides, warranty, and troubleshooting.',
      welcomeMessage: 'Welcome to Electra Kitchen Support. Our AI assistant is ready to help.',
      supportEmail: 'help@electrakitchen.com',
      isActive: true,
    },
  });

  const acmeProduct = await prisma.product.findFirst({ where: { tenantId: TENANT_ID, sku: 'PRD-AERO-001' } });
  const acmeCommodity = acmeProduct
    ? await prisma.commodity.findFirst({ where: { productId: acmeProduct.id, marketId: marketUS.id } })
    : null;

  if (acmeCommodity) {
    await prisma.commodity.update({
      where: { id: acmeCommodity.id },
      data: { warrantyPeriodMonths: 24 },
    });

    const faqData = [
      { question: 'How do I clean my AeroPress?', answer: 'Rinse the plunger and chamber with warm water after each use. For deep cleaning, use a mixture of water and white vinegar, let it soak for 30 minutes, then rinse thoroughly.', category: 'usage', sortOrder: 1 },
      { question: 'What grind size should I use?', answer: 'We recommend a medium-fine grind, similar to table salt. For a stronger brew, use a finer grind. For a lighter brew, use a coarser grind.', category: 'usage', sortOrder: 2 },
      { question: 'How long is the warranty?', answer: 'All Acme Coffee products come with a 24-month warranty from the date of purchase. Register your product to activate warranty coverage.', category: 'warranty', sortOrder: 3 },
      { question: 'My AeroPress is leaking. What should I do?', answer: 'Check that the rubber seal on the plunger is properly seated. If the seal is worn or damaged, contact our support team for a free replacement seal.', category: 'troubleshooting', sortOrder: 4 },
      { question: 'Can I use the AeroPress for cold brew?', answer: 'Yes! Add coffee grounds and cold water, stir gently, and let it steep for 12-24 hours in the refrigerator. Press as usual for a smooth cold brew concentrate.', category: 'usage', sortOrder: 5 },
    ];

    for (const faq of faqData) {
      const existing = await prisma.consumerFAQ.findFirst({
        where: { tenantId: TENANT_ID, brandId: brandAcme.id, commodityId: acmeCommodity.id, question: faq.question },
      });
      if (!existing) {
        await prisma.consumerFAQ.create({
          data: { tenantId: TENANT_ID, brandId: brandAcme.id, commodityId: acmeCommodity.id, ...faq, isActive: true },
        });
      }
    }

    const brandFaqs = [
      { question: 'Where can I buy Acme Coffee products?', answer: 'Our products are available on Amazon US, Amazon DE, and our official website. Check the product page for direct purchase links.', category: 'general', sortOrder: 10 },
      { question: 'How do I contact customer support?', answer: 'You can chat with our AI assistant right here, or email us at support@acmecoffee.com. We typically respond within 24 hours.', category: 'general', sortOrder: 11 },
    ];

    for (const faq of brandFaqs) {
      const existing = await prisma.consumerFAQ.findFirst({
        where: { tenantId: TENANT_ID, brandId: brandAcme.id, commodityId: null, question: faq.question },
      });
      if (!existing) {
        await prisma.consumerFAQ.create({
          data: { tenantId: TENANT_ID, brandId: brandAcme.id, commodityId: null, ...faq, isActive: true },
        });
      }
    }

    const existingMedia = await prisma.commodityMedia.findFirst({ where: { commodityId: acmeCommodity.id } });
    if (!existingMedia) {
      await prisma.commodityMedia.createMany({
        data: [
          { commodityId: acmeCommodity.id, type: 'usage', title: 'How to Brew with AeroPress', url: 'https://www.youtube.com/watch?v=j5Slql2fS7c', platform: 'youtube', language: 'en', aiSummary: 'Step-by-step brewing guide covering grind size, water temperature, and pressing technique.', duration: 240, sortOrder: 1 },
          { commodityId: acmeCommodity.id, type: 'unboxing', title: 'AeroPress Unboxing & First Impressions', url: 'https://www.youtube.com/watch?v=ZgIp3KWnJLU', platform: 'youtube', language: 'en', aiSummary: 'Unboxing video showing package contents: AeroPress, filters, stirrer, scoop, and manual.', duration: 180, sortOrder: 2 },
          { commodityId: acmeCommodity.id, type: 'repair', title: 'Replacing the AeroPress Seal', url: 'https://www.youtube.com/watch?v=rpyBYuu-wJI', platform: 'youtube', language: 'en', aiSummary: 'Guide for replacing the rubber plunger seal when it becomes worn.', duration: 120, sortOrder: 3 },
          { commodityId: acmeCommodity.id, type: 'recipe_demo', title: 'Iced Latte with AeroPress', url: 'https://www.youtube.com/watch?v=fILKEr3P8F4', platform: 'youtube', language: 'en', aiSummary: 'How to make a refreshing iced latte using your AeroPress with the inverted method.', duration: 300, sortOrder: 4 },
          { commodityId: acmeCommodity.id, type: 'recipe_demo', title: 'AeroPress Espresso-Style Shot', url: 'https://www.youtube.com/watch?v=pmjPjZZRhNQ', platform: 'youtube', language: 'en', aiSummary: 'Brew a concentrated espresso-style shot perfect for lattes and cappuccinos.', duration: 180, sortOrder: 5 },
        ],
      });
    }
  }

  if (acmeCommodity) {
    const existingScans = await prisma.qRScanEvent.count({ where: { tenantId: TENANT_ID, commodityId: acmeCommodity.id } });
    if (existingScans === 0) {
      const sources = ['package', 'manual', 'warranty_card', 'colorbox', 'web'];
      const scanData = [];
      for (let i = 0; i < 25; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        scanData.push({
          tenantId: TENANT_ID,
          commodityId: acmeCommodity.id,
          source: sources[Math.floor(Math.random() * sources.length)]!,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          ipCountry: ['US', 'DE', 'GB', 'JP', 'CA'][Math.floor(Math.random() * 5)],
          scannedAt: new Date(Date.now() - daysAgo * 86_400_000),
        });
      }
      await prisma.qRScanEvent.createMany({ data: scanData });
    }
  }

  console.log('  ✓ 2 portal configs, FAQs, media, QR scans');

  console.log('\n=== Seed Complete ===');
  console.log('Login credentials for all users: password = harness123');
  console.log('Roles: system_admin, tenant_admin, operator, supplier, viewer');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
