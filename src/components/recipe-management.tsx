'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Package, Utensils, Search, AlertCircle, Layers } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  hasVariants: boolean;
  variants?: MenuItemVariant[];
}

interface MenuItemVariant {
  id: string;
  menuItemId: string;
  variantType: {
    name: string;
  };
  variantOption: {
    name: string;
  };
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface Recipe {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantityRequired: number;
  unit: string;
  menuItemVariantId: string | null;
  version: number;
  menuItem?: MenuItem;
  ingredient?: Ingredient;
  variant?: {
    variantType: { name: string };
    variantOption: { name: string };
  };
}

interface RecipeFormData {
  menuItemId: string;
  ingredientId: string;
  quantityRequired: string;
  menuItemVariantId: string;
}

export default function RecipeManagement() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('all');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<RecipeFormData>({
    menuItemId: '',
    ingredientId: '',
    quantityRequired: '',
    menuItemVariantId: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all real data from database
      const [menuItemsRes, ingredientsRes, recipesRes] = await Promise.all([
        fetch('/api/menu-items?active=true&includeVariants=true'),
        fetch('/api/ingredients'),
        fetch('/api/recipes'),
      ]);

      if (menuItemsRes.ok) {
        const menuItemsData = await menuItemsRes.json();
        setMenuItems(menuItemsData.menuItems || []);
      }

      if (ingredientsRes.ok) {
        const ingredientsData = await ingredientsRes.json();
        setIngredients(ingredientsData.ingredients || []);
      }

      if (recipesRes.ok) {
        const recipesData = await recipesRes.json();
        setRecipes(recipesData.recipes || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedMenuItemVariants = () => {
    const menuItem = menuItems.find((i) => i.id === formData.menuItemId);
    return menuItem?.variants || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        menuItemId: formData.menuItemId,
        ingredientId: formData.ingredientId,
        quantityRequired: formData.quantityRequired,
      };

      // Only include menuItemVariantId if the menu item has variants and a variant is selected (not "base")
      const menuItem = menuItems.find((i) => i.id === formData.menuItemId);
      if (menuItem?.hasVariants && formData.menuItemVariantId && formData.menuItemVariantId !== 'base') {
        payload.menuItemVariantId = formData.menuItemVariantId;
      }

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setDialogOpen(false);
        resetForm();
        await fetchData();
      } else {
        alert(data.error || 'Failed to save recipe');
      }
    } catch (error) {
      console.error('Failed to save recipe:', error);
      alert('Failed to save recipe');
    }
  };

  const handleDelete = async (recipeId: string) => {
    if (!confirm('Are you sure you want to remove this ingredient from the recipe?')) return;
    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      } else {
        alert('Failed to delete recipe');
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  const resetForm = () => {
    setFormData({
      menuItemId: '',
      ingredientId: '',
      quantityRequired: '',
      menuItemVariantId: '',
    });
  };

  const handleMenuItemChange = (menuItemId: string) => {
    setFormData({
      ...formData,
      menuItemId,
      menuItemVariantId: '', // Reset variant when menu item changes
    });
  };

  const getMenuItemName = (menuItemId: string) => {
    const item = menuItems.find((i) => i.id === menuItemId);
    return item?.name || 'Unknown';
  };

  const getIngredientName = (ingredientId: string) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    return ingredient?.name || 'Unknown';
  };

  const getIngredientUnit = (ingredientId: string) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    return ingredient?.unit || 'units';
  };

  const getVariantName = (recipe: Recipe) => {
    if (!recipe.variant) return 'Base Item';
    return `${recipe.variant.variantType.name}: ${recipe.variant.variantOption.name}`;
  };

  const filteredRecipes = recipes.filter((recipe) => {
    const menuItem = menuItems.find((i) => i.id === recipe.menuItemId);
    const matchesSearch = menuItem?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getIngredientName(recipe.ingredientId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMenuItem = selectedMenuItemId === 'all' || recipe.menuItemId === selectedMenuItemId;
    const matchesVariant = selectedVariantId === 'all' ||
                          (selectedVariantId === 'base' && recipe.menuItemVariantId === null) ||
                          recipe.menuItemVariantId === selectedVariantId;
    return matchesSearch && matchesMenuItem && matchesVariant;
  });

  // Filter variant dropdown options based on selected menu item
  const availableVariants = selectedMenuItemId !== 'all'
    ? (menuItems.find((i) => i.id === selectedMenuItemId)?.variants || [])
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-6 w-6" />
            Recipe Management
          </CardTitle>
          <CardDescription className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <span>
              Link ingredients to menu items and variants to enable automatic inventory deduction.
              Every sale reduces inventory based on recipe quantities.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedMenuItemId} onValueChange={(value) => {
              setSelectedMenuItemId(value);
              setSelectedVariantId('all'); // Reset variant filter when menu item changes
            }}>
              <SelectTrigger className="md:w-[250px]">
                <SelectValue placeholder="All Menu Items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Menu Items</SelectItem>
                {menuItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.hasVariants && <Badge variant="outline" className="ml-2 text-xs">Has Variants</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {availableVariants.length > 0 && (
              <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                <SelectTrigger className="md:w-[200px]">
                  <SelectValue placeholder="All Variants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Variants</SelectItem>
                  <SelectItem value="base">Base Item (No Variant)</SelectItem>
                  {availableVariants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.variantType.name}: {variant.variantOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Recipe Line
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Add Recipe Line</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="menuItemId">Menu Item</Label>
                      <Select
                        value={formData.menuItemId}
                        onValueChange={handleMenuItemChange}
                        required
                      >
                        <SelectTrigger id="menuItemId">
                          <SelectValue placeholder="Select menu item" />
                        </SelectTrigger>
                        <SelectContent>
                          {menuItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} {item.hasVariants && <Badge variant="outline" className="ml-2 text-xs">Variants</Badge>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Variant Selector - Only show if menu item has variants */}
                    {getSelectedMenuItemVariants().length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="menuItemVariantId">Variant (Optional)</Label>
                        <Select
                          value={formData.menuItemVariantId}
                          onValueChange={(value) => setFormData({ ...formData, menuItemVariantId: value })}
                        >
                          <SelectTrigger id="menuItemVariantId">
                            <SelectValue placeholder="Select variant or leave empty for base item" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base">Base Item (No Variant)</SelectItem>
                            {getSelectedMenuItemVariants().map((variant) => (
                              <SelectItem key={variant.id} value={variant.id}>
                                {variant.variantType.name}: {variant.variantOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Leave empty to create a recipe for the base menu item, or select a variant for that specific variant's recipe.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="ingredientId">Ingredient</Label>
                      <Select
                        value={formData.ingredientId}
                        onValueChange={(value) => setFormData({ ...formData, ingredientId: value })}
                        required
                      >
                        <SelectTrigger id="ingredientId">
                          <SelectValue placeholder="Select ingredient" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ingredient) => (
                            <SelectItem key={ingredient.id} value={ingredient.id}>
                              {ingredient.name} ({ingredient.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantityRequired">Quantity Required</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="quantityRequired"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.quantityRequired}
                          onChange={(e) => setFormData({ ...formData, quantityRequired: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                        <Badge variant="outline">
                          {formData.ingredientId && getIngredientUnit(formData.ingredientId)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Amount of this ingredient needed per menu item sold
                      </p>
                    </div>
                  </div>
                  <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full sm:w-auto h-11 min-h-[44px]">Add to Recipe</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Recipes ({filteredRecipes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[800px] md:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu Item</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Quantity Required</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium">{getMenuItemName(recipe.menuItemId)}</TableCell>
                      <TableCell>
                        {recipe.menuItemVariantId ? (
                          <Badge variant="secondary" className="gap-1">
                            <Layers className="h-3 w-3" />
                            {getVariantName(recipe)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Base Item</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getIngredientName(recipe.ingredientId)}</TableCell>
                      <TableCell>{recipe.quantityRequired}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{recipe.unit}</Badge>
                      </TableCell>
                      <TableCell>v{recipe.version}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(recipe.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRecipes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-600">
                        No recipes found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
