/**
 * Module 8 : La distance.
 *
 * La découverte apprend à ne montrer que les profils assez proches, et à dire
 * à quelle distance ils sont, sans jamais révéler où ils habitent.
 *
 * Contrat attendu, exporté par `src/academie/module-8.ts` : les fonctions du
 * module 7, avec une position sur le membre et une distance dans la découverte.
 *
 *   export function createMember(input?: {
 *     ...les champs du module 7
 *     latitude?: number; longitude?: number   // en degrés décimaux
 *   }): Promise<string>
 *
 *   export function discover(input: {
 *     viewerId: string; today: string
 *     maxDistanceKm?: number                  // absent : pas de limite
 *     cursor?: string | null; limit?: number
 *   }): Promise<{
 *     items: { memberId: string; name: string; age: number; distanceKm?: number }[]
 *     nextCursor: string | null
 *   }>
 *
 * La distance se mesure sur la Terre, en suivant sa courbure : la formule de
 * haversine, avec un rayon terrestre de 6 371 km. Un degré de longitude ne
 * vaut pas un degré de latitude, et Madagascar est dans l'hémisphère sud : ses
 * latitudes sont négatives.
 *
 * `distanceKm` est un entier, arrondi au kilomètre le plus proche, et vaut 1 au
 * moins. Elle est présente quand les deux membres ont une position. Un profil
 * sans position n'apparaît pas quand `maxDistanceKm` est donné.
 *
 * Aucun résultat ne contient de latitude ni de longitude. Avec une position
 * exacte, n'importe qui retrouverait la maison d'un membre.
 */
import { describe, expect, it } from 'vitest'
import { createMember, discover } from '../../../src/academie/module-8'
import { bornAged, todayInMadagascar } from '../_support/dates'

const today = todayInMadagascar()

// Le centre d'Antananarivo. Un degré de latitude vaut environ 111,2 km.
const tana = { latitude: -18.9137, longitude: 47.5361 }

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Une position à `km` kilomètres au nord du centre. */
function north(km: number) {
  return { latitude: tana.latitude + km / 111.19493, longitude: tana.longitude }
}

async function seen(viewerId: string, maxDistanceKm?: number) {
  const result = await discover({ viewerId, today, maxDistanceKm })
  return result.items
}

describe('le rayon de recherche', () => {
  it('montre un profil à 9 km et cache celui à 11 km, pour un rayon de 10 km', async () => {
    const city = uniqueCity('rayon')
    const viewer = await createMember({ city, ...tana })
    const near = await createMember({ city, ...north(9) })
    await createMember({ city, ...north(11) })

    expect((await seen(viewer, 10)).map((item) => item.memberId)).toEqual([near])
  })

  // Le piège classique : multiplier les degrés par 111 dans les deux directions.
  it('mesure la distance sur la Terre, pas en degrés', async () => {
    const city = uniqueCity('courbure')
    const viewer = await createMember({ city, ...tana })
    // 0,0935 degré vers l'est : 9,8 km à cette latitude, et non 10,4 km.
    const east = await createMember({ city, latitude: tana.latitude, longitude: tana.longitude + 0.0935 })

    expect((await seen(viewer, 10)).map((item) => item.memberId)).toEqual([east])
  })

  it('cache un profil sans position quand un rayon est donné', async () => {
    const city = uniqueCity('sans-position')
    const viewer = await createMember({ city, ...tana })
    const placed = await createMember({ city, ...north(2) })
    await createMember({ city })

    expect((await seen(viewer, 10)).map((item) => item.memberId)).toEqual([placed])
  })

  it('montre tous les profils de la ville sans rayon', async () => {
    const city = uniqueCity('sans-rayon')
    const viewer = await createMember({ city, ...tana })
    await createMember({ city, ...north(40) })
    await createMember({ city })

    expect(await seen(viewer)).toHaveLength(2)
  })

  it('combine le rayon avec la tranche d’âge', async () => {
    const city = uniqueCity('rayon-et-age')
    const viewer = await createMember({ city, ...tana, birthDate: bornAged(30, today), ageMin: 25, ageMax: 35 })
    const match = await createMember({ city, ...north(3), birthDate: bornAged(30, today) })
    await createMember({ city, ...north(3), birthDate: bornAged(22, today) })
    await createMember({ city, ...north(30), birthDate: bornAged(30, today) })

    expect((await seen(viewer, 10)).map((item) => item.memberId)).toEqual([match])
  })
})

describe('la distance affichée', () => {
  it('donne la distance en kilomètres entiers', async () => {
    const city = uniqueCity('arrondi')
    const viewer = await createMember({ city, ...tana })
    await createMember({ city, ...north(9) })

    const [item] = await seen(viewer, 10)
    expect(item?.distanceKm).toBe(9)
  })

  it('n’annonce jamais moins d’un kilomètre', async () => {
    const city = uniqueCity('voisin')
    const viewer = await createMember({ city, ...tana })
    await createMember({ city, ...north(0.2) })

    const [item] = await seen(viewer, 10)
    expect(item?.distanceKm).toBe(1)
  })

  it('ne rend jamais la position d’un membre', async () => {
    const city = uniqueCity('vie-privee')
    const viewer = await createMember({ city, ...tana })
    const position = north(4)
    await createMember({ city, ...position })

    const items = await seen(viewer, 10)
    expect(items).toHaveLength(1)
    const text = JSON.stringify(items)
    expect(Object.keys(items[0] ?? {}).join(' '), 'aucune coordonnée dans un résultat').not.toMatch(
      /lat|lon|lng|position|coord/i,
    )
    expect(text, 'la latitude ne quitte pas le serveur').not.toContain(position.latitude.toFixed(3))
  })
})
