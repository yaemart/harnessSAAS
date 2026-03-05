import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const item = await prisma.product.findFirst({
            where: { id: "74dba04f-bb8a-477a-8966-92c58662e5d2" },
            include: {
                brand: true,
                category: { include: { attributeSchemas: true } },
                supplier: true,
                commodities: { include: { market: true, media: true } },
                externalSkuMappings: true,
            },
        });
        console.log(item ? "Success!" : "Not Found");
    } catch(e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
