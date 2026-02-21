// Database Seeding Function
// This function can be called from an API endpoint to seed the database remotely

import bcrypt from 'bcryptjs';

interface SeedResult {
  success: boolean;
  message: message;
  data?: {
    users?: { username: string; role: string; name: string; branchId?: string }[];
    branches?: { id: string; branchName: string; licenseKey: string }[];
    categories?: string[];
    menuItems?: number;
    ingredients?: number;
    inventoryItems?: number;
    deliveryAreas?: string[];
    costCategories?: string[];
  };
  error?: string;
}

/**
 * Seeds the database with initial data
 * Can be called from an API endpoint
 */
export async function seedDatabase(): Promise<SeedResult> {
  try {
    const results: any = {
      users: [],
      branches: [],
      categories: [],
      menuItems: 0,
      ingredients: 0,
      inventoryItems: 0,
      deliveryAreas: [],
      costCategories: []
    };

    console.log('🌱 Starting database seeding...\n');

    // ========================================
    // 1. CREATE BRANCHES (before users that reference them)
    // ========================================
    console.log('🏢 Creating branches...');

    const downtown = await db.branch.upsert({
      where: { branchName: 'Downtown' },
      update: {},
      create: {
        id: 'cml46do4q0000ob5g27krklqe',
        branchName: 'Downtown',
        licenseKey: 'LIC-DOWNTOWN-2024',
        licenseExpiresAt: new Date('2025-12-31'),
        isActive: true,
        menuVersion: 1,
        pricingVersion: 1,
        recipeVersion: 1,
        ingredientVersion: 1,
        userVersion: 1,
        serialYear: 2024,
        lastSerial: 0,
      },
    })
    results.branches.push({ id: downtown.id, branchName: downtown.branchName, licenseKey: downtown.licenseKey });
    console.log('  ✅ Downtown branch created');

    const airport = await db.branch.upsert({
      where: { branchName: 'Airport' },
      update: {},
      create: {
        id: 'cml46do4s0001ob5gs267tqmu',
        branchName: 'Airport',
        licenseKey: 'LIC-AIRPORT-2024',
        licenseExpiresAt: new Date('2025-12-31'),
        isActive: true,
        menuVersion: 1,
        pricingVersion: 1,
        recipeVersion: 1,
        ingredientVersion: 1,
        userVersion: 1,
        serialYear: 2024,
        lastSerial: 0,
      },
    })
    results.branches.push({ id: airport.id, branchName: airport.branchName, licenseKey: airport.licenseKey });
    console.log('  ✅ Airport branch created\n');

    // ========================================
    // 2. CREATE USERS
    // ========================================
    console.log('👤 Creating users...');

    const adminPassword = await bcrypt.hash('admin123', 10);
    const managerPassword = await bcrypt.hash('manager123', 10);
    const cashierPassword = await bcrypt.hash('cashier123', 10);

    const admin = await db.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@emperor.coffee',
        passwordHash: adminPassword,
        name: 'HQ Administrator',
        role: 'ADMIN',
        isActive: true,
      },
    })
    results.users.push({
      username: 'admin',
      role: 'ADMIN',
      name: 'HQ Administrator'
    });
    console.log('  ✅ Admin user created (username: admin, password: admin123)');

    // Now create manager and cashier with valid branch IDs
    const manager = await db.user.upsert({
      where: { username: 'manager1' },
      update: {},
      create: {
        username: 'manager1',
        email: 'manager.downtown@emperor.coffee',
        passwordHash: managerPassword,
        name: 'Downtown Manager',
        role: 'BRANCH_MANAGER',
        branchId: downtown.id,
        isActive: true,
      },
    })
    results.users.push({
      username: 'manager1',
      role: 'BRANCH_MANAGER',
      name: 'Downtown Manager',
      branchId: downtown.id
    });
    console.log('  ✅ Manager created (username: manager1, password: manager123)');

    const cashier = await db.user.upsert({
      where: { username: 'cashier1' },
      update: {},
      create: {
        username: 'cashier1',
        email: 'cashier.downtown@emperor.coffee',
        passwordHash: cashierPassword,
        name: 'Downtown Cashier',
        role: 'CASHIER',
        branchId: downtown.id,
        isActive: true,
      },
    })
    results.users.push({
      username: 'cashier1',
      role: 'CASHIER',
      name: 'Downtown Cashier',
      branchId: downtown.id
    });
    console.log('  ✅ Cashier created (username: cashier1, password: cashier123)\n');

    // ========================================
    // 3. CREATE CATEGORIES
    // ========================================
    console.log('📂 Creating categories...');

    const hotDrinks = await db.category.upsert({
      where: { name: 'Hot Drinks' },
      update: {},
      create: {
        name: 'Hot Drinks',
        description: 'Hot coffee and beverages',
        sortOrder: 1,
        isActive: true,
      },
    })
    results.categories.push('Hot Drinks');
    console.log('  ✅ Hot Drinks category created');

    const icedDrinks = await db.category.upsert({
      where: { name: 'Iced Drinks' },
      update: {},
      create: {
        name: 'Iced Drinks',
        description: 'Iced coffee and cold beverages',
        sortOrder: 2,
        isActive: true,
      },
    })
    results.categories.push('Iced Drinks');
    console.log('  ✅ Iced Drinks category created');

    const pastries = await db.category.upsert({
      where: { name: 'Pastries' },
      update: {},
      create: {
        name: 'Pastries',
        description: 'Fresh baked goods',
        sortOrder: 3,
        isActive: true,
      },
    })
    results.categories.push('Pastries');
    console.log('  ✅ Pastries category created');

    const snacks = await db.category.upsert({
      where: { name: 'Snacks' },
      update: {},
      create: {
        name: 'Snacks',
        description: 'Quick snacks and sandwiches',
        sortOrder: 4,
        isActive: true,
      },
    })
    results.categories.push('Snacks');
    console.log('  ✅ Snacks category created\n');

    // ========================================
    // 4. CREATE INGREDIENTS
    // ========================================
    console.log('📦 Creating ingredients...');

    const espresso = await db.ingredient.upsert({
      where: { name: 'Espresso Beans' },
      update: {},
      create: {
        name: 'Espresso Beans',
        unit: 'kg',
        costPerUnit: 25.00,
        reorderThreshold: 5,
        version: 1,
      },
    })
    results.ingredients++;
    console.log('  ✅ Espresso Beans created');

    const milk = await db.ingredient.upsert({
      where: { name: 'Whole Milk' },
      update: {},
      create: {
        name: 'Whole Milk',
        unit: 'L',
        costPerUnit: 2.50,
        reorderThreshold: 10,
        version: 1,
      },
    })
    results.ingredients++;
    console.log('  ✅ Whole Milk created');

    const foam = await db.ingredient.upsert({
      where: { name: 'Oat Milk' },
      update: {},
      create: {
        name: 'Oat Milk',
        unit: 'L',
        costPerUnit: 4.00,
        reorderThreshold: 5,
        version: 1,
      },
    })
    results.ingredients++;
    console.log('  ✅ Oat Milk created');

    const syrup = await db.ingredient.upsert({
      where: { name: 'Vanilla Syrup' },
      update: {},
      create: {
        name: 'Vanilla Syrup',
        unit: 'L',
        costPerUnit: 15.00,
        reorderThreshold: 3,
        version: 1,
      },
    })
    results.ingredients++;
    console.log('  ✅ Vanilla Syrup created');

    const chocolate = await db.ingredient.upsert({
      where: { name: 'Chocolate Powder' },
      update: {},
      create: {
        name: 'Chocolate Powder',
        unit: 'kg',
        costPerUnit: 18.00,
        reorderThreshold: 2,
        version: 1,
      },
    })
    results.ingredients++;
    console.log('  ✅ Chocolate Powder created\n');

    // ========================================
    // 5. CREATE MENU ITEMS
    // ========================================
    console.log('☕ Creating menu items...');

    const espressoItem = await db.menuItem.upsert({
      where: { id: 'espresso-001' },
      update: {},
      create: {
        id: 'espresso-001',
        name: 'Espresso',
        category: 'Hot Drinks',
        categoryId: hotDrinks.id,
        price: 3.50,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 1,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Espresso created');

    const americano = await db.menuItem.upsert({
      where: { id: 'americano-001' },
      update: {},
      create: {
        id: 'americano-001',
        name: 'Americano',
        category: 'Hot Drinks',
        categoryId: hotDrinks.id,
        price: 4.00,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 2,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Americano created');

    const latte = await db.menuItem.upsert({
      where: { id: 'latte-001' },
      update: {},
      create: {
        id: 'latte-001',
        name: 'Latte',
        category: 'Hot Drinks',
        categoryId: hotDrinks.id,
        price: 5.50,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 3,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Latte created');

    const cappuccino = await db.menuItem.upsert({
      where: { id: 'cappuccino-001' },
      update: {},
      create: {
        id: 'cappuccino-001',
        name: 'Cappuccino',
        category: 'Hot Drinks',
        categoryId: hotDrinks.id,
        price: 5.00,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 4,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Cappuccino created');

    const mocha = await db.menuItem.upsert({
      where: { id: 'mocha-001' },
      update: {},
      create: {
        id: 'mocha-001',
        name: 'Mocha',
        category: 'Hot Drinks',
        categoryId: hotDrinks.id,
        price: 6.00,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 5,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Mocha created');

    const icedLatte = await db.menuItem.upsert({
      where: { id: 'iced-latte-001' },
      update: {},
      create: {
        id: 'iced-latte-001',
        name: 'Iced Latte',
        category: 'Iced Drinks',
        categoryId: icedDrinks.id,
        price: 6.00,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 1,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Iced Latte created');

    const icedAmericano = await db.menuItem.upsert({
      where: { id: 'iced-americano-001' },
      update: {},
      create: {
        id: 'iced-americano-001',
        name: 'Iced Americano',
        category: 'Iced Drinks',
        categoryId: icedDrinks.id,
        price: 4.50,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 2,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Iced Americano created');

    const croissant = await db.menuItem.upsert({
      where: { id: 'croissant-001' },
      update: {},
      create: {
        id: 'croissant-001',
        name: 'Croissant',
        category: 'Pastries',
        categoryId: pastries.id,
        price: 4.50,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 1,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Croissant created');

    const muffin = await db.menuItem.upsert({
      where: { id: 'muffin-001' },
      update: {},
      create: {
        id: 'muffin-001',
        name: 'Blueberry Muffin',
        category: 'Pastries',
        categoryId: pastries.id,
        price: 4.00,
        taxRate: 0.14,
        isActive: true,
        sortOrder: 2,
        hasVariants: false,
        version: 1,
      },
    })
    results.menuItems++;
    console.log('  ✅ Blueberry Muffin created\n');

    // ========================================
    // 6. CREATE RECIPES
    // ========================================
    console.log('📝 Creating recipes...');

    // Helper function to create or update recipe
    async function createOrUpdateRecipe(menuItemId: string, ingredientId: string, quantity: number, unit: string, menuItemVariantId: string | null = null) {
      // Check if recipe exists
      const existing = await db.recipe.findFirst({
        where: {
          menuItemId,
          ingredientId,
          menuItemVariantId,
        },
      });

      if (existing) {
        await db.recipe.update({
          where: { id: existing.id },
          data: { quantityRequired: quantity, unit, version: 1 },
        });
      } else {
        await db.recipe.create({
          data: {
            menuItemId,
            ingredientId,
            quantityRequired: quantity,
            unit,
            menuItemVariantId,
            version: 1,
          },
        });
      }
    }

    await createOrUpdateRecipe(espressoItem.id, espresso.id, 0.018, 'kg');
    console.log('  ✅ Espresso recipe created');

    await createOrUpdateRecipe(americano.id, espresso.id, 0.018, 'kg');
    console.log('  ✅ Americano recipe created');

    await createOrUpdateRecipe(latte.id, espresso.id, 0.018, 'kg');
    console.log('  ✅ Latte recipe (espresso) created');

    await createOrUpdateRecipe(latte.id, milk.id, 0.2, 'L');
    console.log('  ✅ Latte recipe (milk) created');

    await createOrUpdateRecipe(latte.id, syrup.id, 0.015, 'L');
    console.log('  ✅ Latte recipe (syrup) created');

    await createOrUpdateRecipe(mocha.id, espresso.id, 0.018, 'kg');
    console.log('  ✅ Mocha recipe (espresso) created');

    await createOrUpdateRecipe(mocha.id, chocolate.id, 0.015, 'kg');
    console.log('  ✅ Mocha recipe (chocolate) created\n');

    // ========================================
    // 7. CREATE BRANCH INVENTORY
    // ========================================
    console.log('📊 Creating branch inventory...');

    const inventoryItems = [
      { branch: downtown.id, ingredient: espresso.id, stock: 10 },
      { branch: downtown.id, ingredient: milk.id, stock: 20 },
      { branch: downtown.id, ingredient: foam.id, stock: 10 },
      { branch: downtown.id, ingredient: syrup.id, stock: 5 },
      { branch: downtown.id, ingredient: chocolate.id, stock: 3 },
      { branch: airport.id, ingredient: espresso.id, stock: 8 },
      { branch: airport.id, ingredient: milk.id, stock: 15 },
      { branch: airport.id, ingredient: foam.id, stock: 8 },
      { branch: airport.id, ingredient: syrup.id, stock: 4 },
      { branch: airport.id, ingredient: chocolate.id, stock: 2 },
    ];

    for (const item of inventoryItems) {
      await db.branchInventory.upsert({
        where: {
          branchId_ingredientId: {
            branchId: item.branch,
            ingredientId: item.ingredient,
          },
        },
        update: { currentStock: item.stock },
        create: {
          branchId: item.branch,
          ingredientId: item.ingredient,
          currentStock: item.stock,
        },
      })
      results.inventoryItems++;
    }
    console.log(`  ✅ Branch inventory created for Downtown and Airport (${results.inventoryItems} items)\n`);

    // ========================================
    // 8. CREATE DELIVERY AREAS
    // ========================================
    console.log('🚚 Creating delivery areas...');

    await db.deliveryArea.upsert({
      where: { id: 'area-001' },
      update: {},
      create: {
        id: 'area-001',
        name: 'City Center',
        fee: 3.00,
        isActive: true,
      },
    })
    results.deliveryAreas.push('City Center');
    console.log('  ✅ City Center delivery area created');

    await db.deliveryArea.upsert({
      where: { id: 'area-002' },
      update: {},
      create: {
        id: 'area-002',
        name: 'Suburbs',
        fee: 5.00,
        isActive: true,
      },
    })
    results.deliveryAreas.push('Suburbs');
    console.log('  ✅ Suburbs delivery area created');

    // ========================================
    // 9. CREATE COST CATEGORIES
    // ========================================
    console.log('💰 Creating cost categories...');

    await db.costCategory.upsert({
      where: { name: 'Rent' },
      update: {},
      create: {
        name: 'Rent',
        description: 'Monthly rent',
        sortOrder: 1,
        isActive: true,
        icon: 'building',
      },
    })
    results.costCategories.push('Rent');
    console.log('  ✅ Rent cost category created');

    await db.costCategory.upsert({
      where: { name: 'Utilities' },
      update: {},
      create: {
        name: 'Utilities',
        description: 'Electricity, water, gas',
        sortOrder: 2,
        isActive: true,
        icon: 'zap',
      },
    })
    results.costCategories.push('Utilities');
    console.log('  ✅ Utilities cost category created');

    await db.costCategory.upsert({
      where: { name: 'Salaries' },
      update: {},
      create: {
        name: 'Salaries',
        description: 'Employee wages',
        sortOrder: 3,
        isActive: true,
        icon: 'users',
      },
    })
    results.costCategories.push('Salaries');
    console.log('  ✅ Salaries cost category created\n');

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ Database seeding completed successfully!');
    console.log('='.repeat(50));
    console.log('\n📋 Default Login Credentials:\n');
    console.log('  👤 ADMIN');
    console.log('     Username: admin');
    console.log('     Password: admin123\n');
    console.log('  👤 BRANCH MANAGER');
    console.log('     Username: manager1');
    console.log('     Password: manager123\n');
    console.log('  👤 CASHIER');
    console.log('     Username: cashier1');
    console.log('     Password: cashier123\n');
    console.log('🏢 Branches:');
    console.log('  - Downtown (ID: cml46do4q0000ob5g27krklqe)');
    console.log('  - Airport (ID: cml46do4s0001ob5gs267tqmu)\n');
    console.log('☕ Menu Items: ' + results.menuItems + ' items across ' + results.categories.length + ' categories\n');
    console.log('📦 Ingredients: ' + results.ingredients + ' ingredients with initial stock\n');
    console.log('📦 Inventory: ' + results.inventoryItems + ' inventory items across branches');

    return {
      success: true,
      message: 'Database seeded successfully',
      data: results
    };
  } catch (error: any) {
    console.error('❌ Seeding error:', error);

    return {
      success: false,
      message: 'Failed to seed database',
      error: error.message
    };
  }
}
