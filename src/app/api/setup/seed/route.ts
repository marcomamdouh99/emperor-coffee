import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// POST /api/setup/seed
// Seeds the database with initial data
// ============================================

export async function POST(request: NextRequest) {
  try {
    console.log('[Seed API] Starting database seeding...');

    // Check if database is already seeded
    const existingAdmin = await db.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('[Seed API] Database already seeded');
      return NextResponse.json({
        success: true,
        message: 'Database is already seeded',
        data: {
          alreadySeeded: true,
          userCount: await db.user.count(),
          branchCount: await db.branch.count()
        }
      });
    }

    // Seed the database
    const bcrypt = (await import('bcryptjs')).default;

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const managerPassword = await bcrypt.hash('manager123', 10);
    const cashierPassword = await bcrypt.hash('cashier123', 10);

    // Create branches
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
    });

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
    });

    // Create users
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
    });

    await db.user.upsert({
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
    });

    await db.user.upsert({
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
    });

    // Create categories
    const hotDrinks = await db.category.upsert({
      where: { name: 'Hot Drinks' },
      update: {},
      create: {
        name: 'Hot Drinks',
        description: 'Hot coffee and beverages',
        sortOrder: 1,
        isActive: true,
      },
    });

    const icedDrinks = await db.category.upsert({
      where: { name: 'Iced Drinks' },
      update: {},
      create: {
        name: 'Iced Drinks',
        description: 'Iced coffee and cold beverages',
        sortOrder: 2,
        isActive: true,
      },
    });

    const pastries = await db.category.upsert({
      where: { name: 'Pastries' },
      update: {},
      create: {
        name: 'Pastries',
        description: 'Fresh baked goods',
        sortOrder: 3,
        isActive: true,
      },
    });

    const snacks = await db.category.upsert({
      where: { name: 'Snacks' },
      update: {},
      create: {
        name: 'Snacks',
        description: 'Quick snacks and sandwiches',
        sortOrder: 4,
        isActive: true,
      },
    });

    // Create ingredients
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
    });

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
    });

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
    });

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
    });

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
    });

    // Create menu items
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
    });

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
    });

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
    });

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
    });

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
    });

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
    });

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
    });

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
    });

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
    });

    // Create branch inventory
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
      });
    }

    // Create delivery areas
    await db.deliveryArea.upsert({
      where: { id: 'area-001' },
      update: {},
      create: {
        id: 'area-001',
        name: 'City Center',
        fee: 3.00,
        isActive: true,
      },
    });

    await db.deliveryArea.upsert({
      where: { id: 'area-002' },
      update: {},
      create: {
        id: 'area-002',
        name: 'Suburbs',
        fee: 5.00,
        isActive: true,
      },
    });

    // Create cost categories
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
    });

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
    });

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
    });

    console.log('[Seed API] Seeding completed successfully');

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        alreadySeeded: false,
        userCount: 3,
        branchCount: 2,
        menuItems: 9,
        ingredients: 5,
        inventoryItems: 10,
        deliveryAreas: 2,
        costCategories: 3,
        categories: 4
      }
    });
  } catch (error: any) {
    console.error('[Seed API Error]', error);

    return NextResponse.json({
      success: false,
      message: 'Failed to seed database',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

// ============================================
// GET /api/setup/seed
// Check if database is seeded
// ============================================

export async function GET(request: NextRequest) {
  try {
    const userCount = await db.user.count();
    const branchCount = await db.branch.count();

    if (userCount > 0) {
      // Database is seeded
      return NextResponse.json({
        success: true,
        message: 'Database is already seeded',
        data: {
          isSeeded: true,
          userCount,
          branchCount
        }
      });
    } else {
      // Database is not seeded
      return NextResponse.json({
        success: false,
        message: 'Database is not seeded',
        data: {
          isSeeded: false,
          userCount,
          branchCount
        }
      });
    }
  } catch (error: any) {
    console.error('[Seed Check Error]', error);

    return NextResponse.json({
      success: false,
      message: 'Failed to check database seed status',
      error: error.message
    }, { status: 500 });
  }
}
