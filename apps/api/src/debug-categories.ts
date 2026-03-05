
import { prisma } from './db.js';

async function check() {
    const categories = await prisma.category.findMany({
        include: {
            _count: {
                select: { children: true, products: true }
            }
        }
    });

    console.log('--- Categories ---');
    categories.forEach(c => {
        console.log(`ID: ${c.id}, Code: ${c.code}, Name: ${c.name}, Parent: ${c.parentId}, Children: ${c._count.children}, Products: ${c._count.products}`);
    });

    await prisma.$disconnect();
}

check().catch(console.error);
