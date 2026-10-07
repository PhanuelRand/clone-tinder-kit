/**
 * Module 17 : La compatibilité, ou l'ordre de la découverte. Module Platine.
 *
 * Jusqu'ici, la découverte montrait les profils dans l'ordre de la base. Elle
 * les classe maintenant, pour montrer d'abord ceux avec qui une conversation a
 * le plus de chances de commencer.
 *
 * Ordre imposé, du premier au dernier :
 *
 *   1. les membres qui ont envoyé un super like au membre qui regarde, et
 *      qu'il n'a pas encore swipés;
 *   2. puis les centres d'intérêt en commun, du plus grand nombre au plus
 *      petit;
 *   3. à égalité, le membre actif le plus récemment d'abord.
 *
 * Un membre dont la dernière activité date de plus de trente jours n'apparaît
 * plus : un profil abandonné ne répondra pas.
 *
 * Contrat attendu, exporté par `src/academie/module-17.ts` :
 *
 *   export function createMember(input?: {
 *     ...ceux du module 7
 *     interests?: string[]          // par défaut []
 *     lastActiveOn?: string         // 'AAAA-MM-JJ', par défaut la date d'aujourd'hui
 *   }): Promise<string>
 *
 *   export function swipe(input: { fromId; toId; decision; now? })   // module 10
 *
 *   export function discover(input: {
 *     viewerId: string; today: string
 *     cursor?: string | null; limit?: number
 *   }): Promise<{
 *     items: { memberId: string; name: string; age: number; sharedInterests: number }[]
 *     nextCursor: string | null
 *   }>
 *
 * Le classement se calcule dans la base, avec la pagination par curseur du
 * module 7 : le curseur porte la position dans le classement, et les pages
 * suivantes reprennent juste après, sans doublon.
 */
import { describe, expect, it } from 'vitest'
import { createMember, discover, swipe } from '../../../src/academie/module-17'
import { shiftDays, todayInMadagascar } from '../_support/dates'

const today = todayInMadagascar()

/** La date d'il y a `days` jours. */
function daysAgo(days: number) {
  return shiftDays(today, -days)
}

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function order(viewerId: string) {
  return (await discover({ viewerId, today })).items.map((item) => item.memberId)
}

describe('les centres d’intérêt en commun', () => {
  it('classe d’abord ceux qui en partagent le plus', async () => {
    const city = uniqueCity('interets')
    const viewer = await createMember({ city, interests: ['randonnée', 'cuisine', 'musique'] })
    const none = await createMember({ city, interests: ['football'] })
    const one = await createMember({ city, interests: ['cuisine', 'football'] })
    const three = await createMember({ city, interests: ['musique', 'randonnée', 'cuisine'] })

    expect(await order(viewer)).toEqual([three, one, none])
  })

  it('rend le nombre de centres d’intérêt en commun', async () => {
    const city = uniqueCity('compte')
    const viewer = await createMember({ city, interests: ['randonnée', 'cuisine', 'musique'] })
    await createMember({ city, interests: ['cuisine', 'musique', 'lecture'] })

    const [item] = (await discover({ viewerId: viewer, today })).items
    expect(item?.sharedInterests).toBe(2)
  })
})

describe('l’activité', () => {
  it('classe le plus récemment actif d’abord, à égalité d’intérêts', async () => {
    const city = uniqueCity('activite')
    const viewer = await createMember({ city, interests: ['cuisine'] })
    const lastWeek = await createMember({ city, interests: ['cuisine'], lastActiveOn: daysAgo(7) })
    const yesterday = await createMember({ city, interests: ['cuisine'], lastActiveOn: daysAgo(1) })

    expect(await order(viewer)).toEqual([yesterday, lastWeek])
  })

  it('cache un membre inactif depuis plus de trente jours', async () => {
    const city = uniqueCity('inactif')
    const viewer = await createMember({ city })
    const thirtyDays = await createMember({ city, lastActiveOn: daysAgo(30) })
    await createMember({ city, lastActiveOn: daysAgo(31) })

    expect(await order(viewer)).toEqual([thirtyDays])
  })
})

describe('le super like', () => {
  it('place en tête celui qui a envoyé un super like, même sans intérêt commun', async () => {
    const city = uniqueCity('super')
    const viewer = await createMember({ city, interests: ['randonnée', 'cuisine'] })
    const close = await createMember({ city, interests: ['randonnée', 'cuisine'] })
    const admirer = await createMember({ city, interests: ['football'] })
    await swipe({ fromId: admirer, toId: viewer, decision: 'SUPER_LIKE' })

    expect(await order(viewer)).toEqual([admirer, close])
  })

  it('ne place pas en tête celui qui a envoyé un simple like', async () => {
    const city = uniqueCity('simple')
    const viewer = await createMember({ city, interests: ['randonnée'] })
    const close = await createMember({ city, interests: ['randonnée'] })
    const liker = await createMember({ city })
    await swipe({ fromId: liker, toId: viewer, decision: 'LIKE' })

    expect(await order(viewer)).toEqual([close, liker])
  })
})

describe('la pagination du classement', { timeout: 30_000 }, () => {
  it('garde l’ordre du classement d’une page à l’autre, sans doublon', async () => {
    const city = uniqueCity('pages')
    const viewer = await createMember({ city, interests: ['a', 'b', 'c'] })
    const profiles: { interests: string[]; lastActiveOn: string }[] = [
      { interests: ['a'], lastActiveOn: daysAgo(11) },
      { interests: ['a', 'b', 'c'], lastActiveOn: daysAgo(21) },
      { interests: [], lastActiveOn: daysAgo(1) },
      { interests: ['b', 'c'], lastActiveOn: daysAgo(6) },
      { interests: ['c'], lastActiveOn: daysAgo(2) },
      { interests: ['a', 'b'], lastActiveOn: daysAgo(26) },
      { interests: [], lastActiveOn: daysAgo(29) },
    ]
    const ids = []
    for (const profile of profiles) ids.push(await createMember({ city, ...profile }))

    const expected = [ids[1], ids[3], ids[5], ids[4], ids[0], ids[2], ids[6]]
    const seen: string[] = []
    let cursor: string | null = null
    for (let page = 0; page < 10; page += 1) {
      const result: Awaited<ReturnType<typeof discover>> = await discover({ viewerId: viewer, today, cursor, limit: 3 })
      seen.push(...result.items.map((item) => item.memberId))
      cursor = result.nextCursor
      if (!cursor) break
    }

    expect(seen).toEqual(expected)
  })
})
