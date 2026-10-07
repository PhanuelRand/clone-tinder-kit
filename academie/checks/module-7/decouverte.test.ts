/**
 * Module 7 : La découverte et ses filtres.
 *
 * La découverte montre à un membre les profils qui lui correspondent, page par
 * page. La correspondance va dans les deux sens : chacun doit chercher le genre
 * et la tranche d'âge de l'autre.
 *
 * Contrat attendu, exporté par `src/academie/module-7.ts` :
 *
 *   export type Gender = 'WOMAN' | 'MAN' | 'NONBINARY'
 *
 *   export function createMember(input?: {
 *     name?: string                   // par défaut 'Membre'
 *     city?: string                   // par défaut 'Antananarivo'
 *     gender?: Gender                 // par défaut 'WOMAN'
 *     lookingFor?: Gender[]           // par défaut les trois
 *     birthDate?: string              // par défaut '2000-01-01'
 *     ageMin?: number; ageMax?: number  // par défaut 18 et 99
 *     photo?: boolean                 // par défaut true : le profil a une photo
 *   }): Promise<string>               // un membre complet, au courriel inventé
 *
 *   export function discover(input: {
 *     viewerId: string
 *     today: string                   // 'AAAA-MM-JJ', la date du jour, pour les âges
 *     cursor?: string | null; limit?: number
 *   }): Promise<{
 *     items: { memberId: string; name: string; age: number }[]
 *     nextCursor: string | null
 *   }>
 *
 * Un profil apparaît dans la découverte d'un membre quand :
 *   - il est dans la même ville, et ce n'est pas le membre lui-même;
 *   - il a au moins une photo (module 6);
 *   - son genre est cherché par le membre, et le genre du membre est cherché
 *     par lui;
 *   - son âge est dans la tranche du membre, et l'âge du membre est dans la
 *     sienne, bornes comprises.
 *
 * Un résultat donne un âge, jamais la date de naissance, l'adresse
 * électronique ni la position. La pagination est par curseur, jamais par
 * OFFSET : un profil créé pendant qu'on feuillette ne doit ni décaler ni
 * dupliquer les résultats déjà vus.
 */
import { describe, expect, it } from 'vitest'
import { createMember, discover } from '../../../src/academie/module-7'
import { bornAged as bornAgedOn, shiftDays, todayInMadagascar, yearsBefore } from '../_support/dates'

const today = todayInMadagascar()

// Chaque test travaille dans sa propre ville : les suites ne se polluent pas.
function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Une date de naissance qui donne cet âge aujourd'hui. */
function bornAged(age: number) {
  return bornAgedOn(age, today)
}

async function idsSeenBy(viewerId: string) {
  const result = await discover({ viewerId, today })
  return result.items.map((item) => item.memberId)
}

async function allPages(viewerId: string, limit: number) {
  const seen: string[] = []
  let cursor: string | null = null
  for (let page = 0; page < 20; page += 1) {
    const result: Awaited<ReturnType<typeof discover>> = await discover({ viewerId, today, cursor, limit })
    seen.push(...result.items.map((item) => item.memberId))
    cursor = result.nextCursor
    if (!cursor) break
  }
  return seen
}

describe('qui apparaît', () => {
  it('montre les profils de la même ville, pas ceux d’ailleurs ni le sien', async () => {
    const city = uniqueCity('tana')
    const viewer = await createMember({ city })
    const neighbour = await createMember({ city })
    await createMember({ city: uniqueCity('toamasina') })

    expect(await idsSeenBy(viewer)).toEqual([neighbour])
  })

  it('cache un profil sans photo', async () => {
    const city = uniqueCity('photo')
    const viewer = await createMember({ city })
    const complete = await createMember({ city })
    await createMember({ city, photo: false })

    expect(await idsSeenBy(viewer)).toEqual([complete])
  })

  it('ne montre que le genre cherché', async () => {
    const city = uniqueCity('genre')
    const viewer = await createMember({ city, gender: 'MAN', lookingFor: ['WOMAN'] })
    const woman = await createMember({ city, gender: 'WOMAN' })
    await createMember({ city, gender: 'MAN' })
    await createMember({ city, gender: 'NONBINARY' })

    expect(await idsSeenBy(viewer)).toEqual([woman])
  })

  // La correspondance va dans les deux sens.
  it('cache un profil qui ne cherche pas le genre du membre', async () => {
    const city = uniqueCity('reciproque')
    const viewer = await createMember({ city, gender: 'MAN', lookingFor: ['WOMAN'] })
    const open = await createMember({ city, gender: 'WOMAN', lookingFor: ['MAN', 'WOMAN'] })
    await createMember({ city, gender: 'WOMAN', lookingFor: ['WOMAN'] })

    expect(await idsSeenBy(viewer)).toEqual([open])
  })
})

describe('la tranche d’âge', () => {
  it('respecte la tranche du membre, bornes comprises', async () => {
    const city = uniqueCity('age')
    const viewer = await createMember({ city, birthDate: bornAged(28), ageMin: 25, ageMax: 30 })
    const tooYoung = await createMember({ city, birthDate: bornAged(24) })
    const youngest = await createMember({ city, birthDate: bornAged(25) })
    const oldest = await createMember({ city, birthDate: bornAged(30) })
    const tooOld = await createMember({ city, birthDate: bornAged(31) })

    const seen = await idsSeenBy(viewer)
    expect(seen).toContain(youngest)
    expect(seen).toContain(oldest)
    expect(seen).not.toContain(tooYoung)
    expect(seen).not.toContain(tooOld)
  })

  // L'âge se calcule avec la date du jour, au jour près (module 2).
  it('compte l’âge au jour près', async () => {
    const city = uniqueCity('anniversaire')
    const viewer = await createMember({ city, birthDate: bornAged(28), ageMin: 25, ageMax: 30 })
    // 31 ans demain : encore 30 ans aujourd'hui.
    const birthdayTomorrow = await createMember({ city, birthDate: yearsBefore(shiftDays(today, 1), 31) })

    expect(await idsSeenBy(viewer)).toEqual([birthdayTomorrow])
  })

  it('cache un profil dont la tranche n’accepte pas l’âge du membre', async () => {
    const city = uniqueCity('age-reciproque')
    const viewer = await createMember({ city, birthDate: bornAged(40) })
    const accepts = await createMember({ city, birthDate: bornAged(38), ageMax: 45 })
    await createMember({ city, birthDate: bornAged(38), ageMax: 35 })

    expect(await idsSeenBy(viewer)).toEqual([accepts])
  })

  it('rend l’âge, et jamais la date de naissance, le courriel ni la position', async () => {
    const city = uniqueCity('vie-privee')
    const viewer = await createMember({ city })
    const birthDate = shiftDays(bornAged(32), -40)
    await createMember({ city, name: 'Voahangy', birthDate })

    const [item] = (await discover({ viewerId: viewer, today })).items
    expect(item?.age).toBe(32)
    expect(item?.name).toBe('Voahangy')
    const keys = Object.keys(item ?? {}).join(' ')
    expect(keys, 'aucune donnée personnelle dans un résultat').not.toMatch(
      /birth|naissance|email|courriel|lat|lon|lng|position/i,
    )
    expect(JSON.stringify(item), 'la date de naissance ne quitte pas le serveur').not.toContain(birthDate)
  })
})

describe('pagination par curseur', () => {
  it('parcourt tous les profils sans doublon ni oubli', async () => {
    const city = uniqueCity('pagination')
    const viewer = await createMember({ city })
    const created = []
    for (let index = 0; index < 7; index += 1) created.push(await createMember({ city }))

    const seen = await allPages(viewer, 3)
    expect(seen).toHaveLength(created.length)
    expect([...seen].sort()).toEqual([...created].sort())
  })

  // Le test que OFFSET ne passe pas : une inscription décale toutes les pages.
  it('ne décale pas les pages déjà vues quand un profil arrive entre deux', async () => {
    const city = uniqueCity('insertion')
    const viewer = await createMember({ city })
    for (let index = 0; index < 6; index += 1) await createMember({ city })

    const first = await discover({ viewerId: viewer, today, limit: 3 })
    expect(first.nextCursor, 'six profils par pages de trois : il reste une page').toBeTruthy()

    await createMember({ city })

    const second = await discover({ viewerId: viewer, today, cursor: first.nextCursor, limit: 3 })
    const overlap = second.items
      .map((item) => item.memberId)
      .filter((id) => first.items.some((item) => item.memberId === id))
    expect(overlap, 'aucun profil de la page 1 ne doit réapparaître page 2').toEqual([])
  })
})
