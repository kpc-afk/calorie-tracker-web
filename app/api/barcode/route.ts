import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('code')
  if (!barcode) return NextResponse.json({ error: 'Missing barcode' }, { status: 400 })

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'CalorieTrackerApp/1.0' } }
    )
    const data = await res.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const p = data.product
    const nutriments = p.nutriments ?? {}

    const result = {
      name: p.product_name || p.product_name_en || 'Unknown product',
      brand: p.brands ?? undefined,
      serving_size: p.serving_size ? parseFloat(p.serving_size) || 100 : 100,
      serving_unit: 'g',
      calories: Math.round(nutriments['energy-kcal_serving'] ?? nutriments['energy-kcal_100g'] ?? 0),
      protein: Math.round((nutriments['proteins_serving'] ?? nutriments['proteins_100g'] ?? 0) * 10) / 10,
      carbs: Math.round((nutriments['carbohydrates_serving'] ?? nutriments['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat: Math.round((nutriments['fat_serving'] ?? nutriments['fat_100g'] ?? 0) * 10) / 10,
      fiber: Math.round((nutriments['fiber_serving'] ?? nutriments['fiber_100g'] ?? 0) * 10) / 10,
      sugar: Math.round((nutriments['sugars_serving'] ?? nutriments['sugars_100g'] ?? 0) * 10) / 10,
      sodium: Math.round((nutriments['sodium_serving'] ?? nutriments['sodium_100g'] ?? 0) * 1000) / 10,
      saturated_fat: Math.round((nutriments['saturated-fat_serving'] ?? nutriments['saturated-fat_100g'] ?? 0) * 10) / 10,
      cholesterol: 0,
      commentary: `Nutrition data from Open Food Facts for barcode ${barcode}.`,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Barcode lookup error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
