import { redirect } from 'next/navigation'
import { upsertProfile } from '@/lib/db/queries'

export default async function SeedPage() {
  await upsertProfile({
    date_of_birth: '1994-12-14',
    sex: 'male',
    height_cm: 172,
    height_unit: 'cm',
    weight_kg: 83,
    weight_unit: 'kg',
    goal: 'lose',
    bmr: 1755,
    deficit_amount: 656,
    target_calories: 1450,
    protein_target_g: 130,
    carbs_target_g: 120,
    fat_target_g: 50,
    baseline_steps: 5000,
    earn_back_rate: 0.75,
  })
  redirect('/chat')
}
