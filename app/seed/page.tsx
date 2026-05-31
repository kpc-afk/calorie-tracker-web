import { redirect } from 'next/navigation'
import { upsertProfile } from '@/lib/db/queries'

export default async function SeedPage() {
  // BMR: 1755, activity: sedentary (×1.2), TDEE: 2106
  // Deficit: 656 (TDEE − target 1450)
  await upsertProfile({
    date_of_birth: '1994-12-14',
    sex: 'male',
    height_cm: 172,
    height_unit: 'cm',
    weight_kg: 83,
    weight_unit: 'kg',
    goal: 'lose',
    activity_level: 'sedentary',
    bmr: 1755,
    tdee: 2106,
    deficit_amount: 656,
    target_calories: 1450,
    protein_target_g: 130,
    carbs_target_g: 120,
    fat_target_g: 50,
  })
  redirect('/chat')
}
