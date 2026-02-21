import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, invalidateCache, invalidateCachePattern, cacheKeys } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');
    const includeVariants = searchParams.get('includeVariants') === 'true';

    // Generate cache key based on query parameters
    const cacheKey = `menu:items:${category || 'all'}:${active || 'all'}:${includeVariants ? 'variants' : 'no-variants'}`;

    const menuItems = await getCached(cacheKey, async () => {
      return await db.menuItem.findMany({
        where: {
          ...(category && category !== 'all' ? { category } : {}),
          ...(active !== null ? { isActive: active === 'true' } : {}),
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        include: {
          recipes: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  costPerUnit: true,
                  unit: true,
                },
              },
            },
          },
          categoryRel: {
            select: {
              id: true,
              name: true,
            },
          },
          ...(includeVariants ? {
            variants: {
              include: {
                variantType: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                variantOption: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                recipes: {
                  include: {
                    ingredient: {
                      select: {
                        id: true,
                        name: true,
                        costPerUnit: true,
                        unit: true,
                      },
                    },
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          } : {}),
        },
      });
    }, 300000); // 5 minute cache

    // Calculate dynamic product cost for each menu item and its variants
    const menuItemsWithCost = menuItems.map(item => {
      // Calculate base product cost (only from base recipes where menuItemVariantId is null)
      const baseProductCost = item.recipes.reduce((total, recipe) => {
        // Skip variant-specific recipes - only count base recipes
        if (recipe.menuItemVariantId !== null) {
          return total;
        }
        const ingredientCost = recipe.quantityRequired * recipe.ingredient.costPerUnit;
        return total + ingredientCost;
      }, 0);

      // Calculate profit and margin for base item (using base price)
      const profit = item.price - baseProductCost;
      const profitMargin = item.price > 0 ? (profit / item.price) * 100 : 0;

      // Calculate costs for each variant
      const variantsWithCost = item.variants?.map(variant => {
        // Use variant-specific recipes if available, otherwise fall back to base recipes
        const variantRecipes = variant.recipes && variant.recipes.length > 0
          ? variant.recipes
          : item.recipes;

        const variantProductCost = variantRecipes.reduce((total, recipe) => {
          const ingredientCost = recipe.quantityRequired * recipe.ingredient.costPerUnit;
          return total + ingredientCost;
        }, 0);

        const variantPrice = item.price + variant.priceModifier;
        const variantProfit = variantPrice - variantProductCost;
        const variantProfitMargin = variantPrice > 0 ? (variantProfit / variantPrice) * 100 : 0;

        return {
          ...variant,
          productCost: parseFloat(variantProductCost.toFixed(2)),
          profit: parseFloat(variantProfit.toFixed(2)),
          profitMargin: parseFloat(variantProfitMargin.toFixed(2)),
        };
      }) || [];

      return {
        ...item,
        productCost: parseFloat(baseProductCost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        variants: variantsWithCost,
      };
    });

    return NextResponse.json({ menuItems: menuItemsWithCost });
  } catch (error: any) {
    console.error('Get menu items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a PATCH override for updates
    if (body._method === 'PATCH') {
      const { id, name, category, categoryId, price, taxRate, isActive, sortOrder, hasVariants } = body;

      if (!id) {
        return NextResponse.json(
          { error: 'Menu item ID is required' },
          { status: 400 }
        );
      }

      // Check if menu item exists
      const existingItem = await db.menuItem.findUnique({
        where: { id },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: 'Menu item not found' },
          { status: 404 }
        );
      }

      // Validate categoryId if provided and not empty
      if (categoryId && categoryId.trim() !== '') {
        const cat = await db.category.findUnique({ where: { id: categoryId } });
        if (!cat) {
          return NextResponse.json(
            { error: 'Category not found' },
            { status: 404 }
          );
        }
      }

      // Build update data with proper validation
      const updateData: any = {};
      if (name && name.trim() !== '') updateData.name = name.trim();
      if (category && category.trim() !== '') updateData.category = category.trim();
      if (categoryId && categoryId.trim() !== '') updateData.categoryId = categoryId.trim();
      if (price !== undefined && price !== '' && !isNaN(parseFloat(price))) {
        updateData.price = parseFloat(price);
      }
      if (taxRate !== undefined && taxRate !== '' && !isNaN(parseFloat(taxRate))) {
        updateData.taxRate = parseFloat(taxRate);
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      if (sortOrder !== undefined && sortOrder !== '' && !isNaN(parseInt(sortOrder))) {
        updateData.sortOrder = parseInt(sortOrder);
      }
      if (hasVariants !== undefined) updateData.hasVariants = hasVariants;

      // Update menu item
      const menuItem = await db.menuItem.update({
        where: { id },
        data: updateData,
      });

      // Invalidate menu items cache
      invalidateCachePattern('^menu:items:');

      return NextResponse.json({
        success: true,
        menuItem,
      });
    }

    // Original POST logic for creating new items
    const { name, category, categoryId, price, taxRate, isActive, sortOrder, hasVariants } = body;

    if (!name || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price' },
        { status: 400 }
      );
    }

    // Validate categoryId if provided
    let validCategoryId = null;
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
      validCategoryId = categoryId;
    }

    // Create menu item
    const menuItem = await db.menuItem.create({
      data: {
        name,
        category: category || 'Other',
        categoryId: validCategoryId,
        price: parseFloat(price),
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.14,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder !== undefined ? sortOrder : null,
        hasVariants: hasVariants !== undefined ? hasVariants : false,
      },
    });

    // Invalidate menu items cache
    invalidateCachePattern('^menu:items:');

    return NextResponse.json({
      success: true,
      menuItem,
    });
  } catch (error: any) {
    console.error('Menu item POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process menu item request', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, category, categoryId, price, taxRate, isActive, sortOrder, hasVariants } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Menu item ID is required' },
        { status: 400 }
      );
    }

    // Check if menu item exists
    const existingItem = await db.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Validate categoryId if provided and not empty
    if (categoryId && categoryId.trim() !== '') {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Build update data with proper validation
    const updateData: any = {};
    if (name && name.trim() !== '') updateData.name = name.trim();
    if (category && category.trim() !== '') updateData.category = category.trim();
    if (categoryId && categoryId.trim() !== '') updateData.categoryId = categoryId.trim();
    if (price !== undefined && price !== '' && !isNaN(parseFloat(price))) {
      updateData.price = parseFloat(price);
    }
    if (taxRate !== undefined && taxRate !== '' && !isNaN(parseFloat(taxRate))) {
      updateData.taxRate = parseFloat(taxRate);
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined && sortOrder !== '' && !isNaN(parseInt(sortOrder))) {
      updateData.sortOrder = parseInt(sortOrder);
    }
    if (hasVariants !== undefined) updateData.hasVariants = hasVariants;

    // Update menu item
    const menuItem = await db.menuItem.update({
      where: { id },
      data: updateData,
    });

    // Invalidate menu items cache
    invalidateCachePattern('^menu:items:');

    return NextResponse.json({
      success: true,
      menuItem,
    });
  } catch (error: any) {
    console.error('Update menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to update menu item', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Menu item ID is required' },
        { status: 400 }
      );
    }

    // Check if menu item exists
    const existingItem = await db.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Delete menu item (will cascade to order items and recipes)
    await db.menuItem.delete({
      where: { id },
    });

    // Invalidate menu items cache
    invalidateCachePattern('^menu:items:');

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 }
    );
  }
}
