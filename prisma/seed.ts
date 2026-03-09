import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { username: 'admin' }
  });

  if (!existingAdmin) {
    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@emperor.com',
        passwordHash,
        name: 'System Administrator',
        role: 'ADMIN',
        isActive: true,
      }
    });
    console.log('✅ Created admin user:', admin.username);
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // Check if branch exists
  const existingBranch = await prisma.branch.findFirst({
    where: { branchName: 'Main Branch' }
  });

  let branchId: string | undefined;

  if (!existingBranch) {
    // Create a branch
    const branch = await prisma.branch.create({
      data: {
        branchName: 'Main Branch',
        licenseKey: 'LICENSE-' + Date.now(),
        licenseExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isActive: true,
        phone: '+20 123 456 7890',
        address: '123 Main Street, Cairo, Egypt',
      }
    });
    branchId = branch.id;
    console.log('✅ Created branch:', branch.branchName);
  } else {
    branchId = existingBranch.id;
    console.log('ℹ️  Branch already exists:', existingBranch.branchName);
  }

  // Create branch manager
  const existingManager = await prisma.user.findFirst({
    where: { username: 'manager' }
  });

  if (!existingManager && branchId) {
    const passwordHash = await bcrypt.hash('manager123', 10);
    const manager = await prisma.user.create({
      data: {
        username: 'manager',
        email: 'manager@emperor.com',
        passwordHash,
        name: 'Branch Manager',
        role: 'BRANCH_MANAGER',
        branchId,
        isActive: true,
      }
    });
    console.log('✅ Created branch manager:', manager.username);
  } else if (existingManager) {
    console.log('ℹ️  Branch manager already exists');
  }

  // Create cashier
  const existingCashier = await prisma.user.findFirst({
    where: { username: 'cashier' }
  });

  if (!existingCashier && branchId) {
    const passwordHash = await bcrypt.hash('cashier123', 10);
    const cashier = await prisma.user.create({
      data: {
        username: 'cashier',
        email: 'cashier@emperor.com',
        passwordHash,
        name: 'Cashier User',
        role: 'CASHIER',
        branchId,
        isActive: true,
      }
    });
    console.log('✅ Created cashier:', cashier.username);
  } else if (existingCashier) {
    console.log('ℹ️  Cashier already exists');
  }

  // Create some categories
  const categories = [
    { name: 'Hot Coffee', description: 'Freshly brewed coffee drinks', sortOrder: 1 },
    { name: 'Iced Coffee', description: 'Cold coffee beverages', sortOrder: 2 },
    { name: 'Pastries', description: 'Fresh baked goods', sortOrder: 3 },
    { name: 'Snacks', description: 'Light snacks and sides', sortOrder: 4 },
  ];

  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name }
    });

    if (!existing) {
      await prisma.category.create({
        data: category
      });
      console.log('✅ Created category:', category.name);
    } else {
      console.log('ℹ️  Category already exists:', category.name);
    }
  }

  // Get the coffee category
  const hotCoffeeCategory = await prisma.category.findFirst({
    where: { name: 'Hot Coffee' }
  });

  // Create some menu items
  const menuItems = [
    { name: 'Espresso', price: 25, categoryId: hotCoffeeCategory?.id },
    { name: 'Cappuccino', price: 45, categoryId: hotCoffeeCategory?.id },
    { name: 'Latte', price: 50, categoryId: hotCoffeeCategory?.id },
    { name: 'Americano', price: 35, categoryId: hotCoffeeCategory?.id },
    { name: 'Mocha', price: 55, categoryId: hotCoffeeCategory?.id },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name }
    });

    if (!existing) {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          price: item.price,
          category: 'Hot Coffee',
          categoryId: item.categoryId,
          isActive: true,
        }
      });
      console.log('✅ Created menu item:', item.name);
    } else {
      console.log('ℹ️  Menu item already exists:', item.name);
    }
  }

  // Create some ingredients
  const ingredients = [
    { name: 'Coffee Beans', unit: 'kg', costPerUnit: 200, reorderThreshold: 10 },
    { name: 'Milk', unit: 'L', costPerUnit: 25, reorderThreshold: 20 },
    { name: 'Sugar', unit: 'kg', costPerUnit: 15, reorderThreshold: 5 },
    { name: 'Cups', unit: 'unit', costPerUnit: 0.5, reorderThreshold: 100 },
  ];

  for (const ingredient of ingredients) {
    const existing = await prisma.ingredient.findFirst({
      where: { name: ingredient.name }
    });

    if (!existing) {
      const created = await prisma.ingredient.create({
        data: ingredient
      });
      console.log('✅ Created ingredient:', ingredient.name);

      // Create inventory for this branch
      if (branchId) {
        await prisma.branchInventory.create({
          data: {
            branchId,
            ingredientId: created.id,
            currentStock: 50,
          }
        });
        console.log('✅ Created inventory for:', ingredient.name);
      }
    } else {
      console.log('ℹ️  Ingredient already exists:', ingredient.name);
    }
  }

  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Admin:    admin / admin123');
  console.log('  Manager:  manager / manager123');
  console.log('  Cashier:  cashier / cashier123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
