import { prisma } from './db.js';

async function main() {
    console.log("Seeding test reference data...");

    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) {
        console.log("No tenant found. Run seed-tenants.ts first.");
        return;
    }
    const tenantId = tenant.id;

    // 1. Brands
    const brand1 = await prisma.brand.upsert({
        where: { tenantId_code: { tenantId, code: 'BRND-01' } },
        update: {},
        create: {
            tenantId,
            code: 'BRND-01',
            name: 'Acme Coffee Co.',
            description: 'Premium coffee makers and accessories.'
        }
    });

    const brand2 = await prisma.brand.upsert({
        where: { tenantId_code: { tenantId, code: 'BRND-02' } },
        update: {},
        create: {
            tenantId,
            code: 'BRND-02',
            name: 'Electra Kitchen',
            description: 'Modern smart kitchen appliances.'
        }
    });

    // 2. Categories
    const catKitchen = await prisma.category.upsert({
        where: { tenantId_code: { tenantId, code: 'CAT-KITCHEN' } },
        update: {},
        create: {
            tenantId,
            code: 'CAT-KITCHEN',
            name: 'Kitchen & Dining',
            definition: 'Products used for food preparation and dining.'
        }
    });

    const catCoffee = await prisma.category.upsert({
        where: { tenantId_code: { tenantId, code: 'CAT-COFFEE' } },
        update: {},
        create: {
            tenantId,
            code: 'CAT-COFFEE',
            name: 'Coffee Machines',
            definition: 'Devices for brewing coffee.',
            parentId: catKitchen.id
        }
    });

    // 3. Markets
    const marketConfigs = [
        { code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York', langs: ['en', 'sp'] },
        { code: 'CA', name: 'Canada', currency: 'CAD', timezone: 'America/Toronto', langs: ['en', 'fr'] },
        { code: 'UK', name: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London', langs: ['en'] },
        { code: 'EU', name: 'European Union', currency: 'EUR', timezone: 'Europe/Berlin', langs: ['de', 'en', 'fr', 'sp', 'it'] },
        { code: 'AU', name: 'Australia', currency: 'AUD', timezone: 'Australia/Sydney', langs: ['en'] },
        { code: 'JP', name: 'Japan', currency: 'JPY', timezone: 'Asia/Tokyo', langs: ['jp', 'en'] }
    ];

    const seededMarkets: string[] = [];

    for (const conf of marketConfigs) {
        const market = await prisma.market.upsert({
            where: { tenantId_code: { tenantId, code: conf.code } },
            update: {
                name: conf.name,
                currency: conf.currency,
                timezone: conf.timezone
            },
            create: {
                tenantId,
                code: conf.code,
                name: conf.name,
                currency: conf.currency,
                timezone: conf.timezone
            }
        });

        // Ensure languages are correctly set
        await prisma.marketLanguage.deleteMany({
            where: { marketId: market.id }
        });

        await prisma.marketLanguage.createMany({
            data: conf.langs.map((lang, index) => ({
                marketId: market.id,
                language: lang.toLowerCase(),
                isDefault: index === 0
            }))
        });

        seededMarkets.push(market.name);
    }

    // 4. Platforms
    const platAmazon = await prisma.platform.upsert({
        where: { tenantId_code: { tenantId, code: 'amazon-us' } },
        update: {},
        create: {
            tenantId,
            code: 'amazon-us',
            name: 'Amazon US',
            apiType: 'SP-API'
        }
    });

    const platShopify = await prisma.platform.upsert({
        where: { tenantId_code: { tenantId, code: 'shopify-global' } },
        update: {},
        create: {
            tenantId,
            code: 'shopify-global',
            name: 'Shopify Global',
            apiType: 'Shopify-Admin'
        }
    });

    console.log(`Successfully seeded standard test dependencies for Tenant: ${tenant.name}`);
    console.log(`Brands: ${brand1.name}, ${brand2.name}`);
    console.log(`Categories: ${catKitchen.name}, ${catCoffee.name}`);
    console.log(`Markets: ${seededMarkets.join(', ')}`);
    console.log(`Platforms: ${platAmazon.name}, ${platShopify.name}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
