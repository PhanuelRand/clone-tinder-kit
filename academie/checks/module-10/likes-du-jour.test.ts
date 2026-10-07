/**
 * Module 10 : Les likes du jour.
 *
 * Un membre gratuit a droit à vingt likes et un super like par jour. Un membre
 * Premium a des likes illimités et cinq super likes par jour. Refuser un profil
 * (PASS) n'est jamais limité.
 *
 * Le jour est celui de Madagascar : le compteur repart à zéro à minuit, heure
 * d'Antananarivo, c'est-à-dire à 21 h 00 UTC.
 *
 * Contrat attendu, exporté par `src/academie/module-10.ts` :
 *
 *   export function createMember(input?: { ...ceux du module 7 }): Promise<string>
 *
 *   export function grantPremium(input: {
 *     memberId: string; until: string          // un instant ISO 8601
 *   }): Promise<void>        // pour les vérifications; le module 11 le fera par paiement
 *
 *   export function swipe(input: {
 *     fromId: string; toId: string
 *     decision: 'LIKE' | 'PASS' | 'SUPER_LIKE'
 *     now?: string             // un instant ISO 8601; absent : l'horloge
 *   }): Promise<{ accepted: boolean; matched: boolean; matchId?: string; reason?: string }>
 *
 *   export function quota(input: {
 *     memberId: string; now: string
 *   }): Promise<{
 *     likesLeft: number | null      // null : illimité
 *     superLikesLeft: number
 *   }>
 *
 * L'instant d'un swipe est `now`. Un super like compte dans les super likes,
 * pas dans les likes, et fait un match comme un like. `now` est passé par le
 * harnais plutôt que lu sur l'horloge : c'est ce qui rend minuit vérifiable.
 */
import { describe, expect, it } from 'vitest'
import { createMember, grantPremium, quota, swipe } from '../../../src/academie/module-10'

const morning = '2030-07-10T06:00:00.000Z' // 9 h 00 à Madagascar

// Ces tests créent une vingtaine de membres chacun : ils ont droit à plus de temps.

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** `count` membres à liker, dans la ville du membre. */
async function targets(city: string, count: number) {
  const created: string[] = []
  for (let index = 0; index < count; index += 1) created.push(await createMember({ city }))
  return created
}

async function likeAll(fromId: string, toIds: string[], now: string, decision: 'LIKE' | 'PASS' = 'LIKE') {
  const results = []
  for (const toId of toIds) results.push(await swipe({ fromId, toId, decision, now }))
  return results
}

describe('le quota d’un membre gratuit', { timeout: 30_000 }, () => {
  it('commence la journée avec vingt likes et un super like', async () => {
    const memberId = await createMember()
    expect(await quota({ memberId, now: morning })).toEqual({ likesLeft: 20, superLikesLeft: 1 })
  })

  it('décompte les likes, pas les refus', async () => {
    const city = uniqueCity('decompte')
    const memberId = await createMember({ city })
    const people = await targets(city, 5)
    await likeAll(memberId, people.slice(0, 3), morning, 'LIKE')
    await likeAll(memberId, people.slice(3), morning, 'PASS')

    expect((await quota({ memberId, now: morning })).likesLeft).toBe(17)
  })

  it('refuse le vingt et unième like, avec un motif, et laisse encore passer', async () => {
    const city = uniqueCity('vingt-et-un')
    const memberId = await createMember({ city })
    const people = await targets(city, 22)

    const results = await likeAll(memberId, people.slice(0, 20), morning)
    expect(results.every((result) => result.accepted), 'vingt likes sont permis').toBe(true)

    const extra = await swipe({ fromId: memberId, toId: people[20] ?? '', decision: 'LIKE', now: morning })
    expect(extra.accepted, 'le vingt et unième like doit être refusé').toBe(false)
    expect(extra.reason, 'le refus doit porter un motif lisible').toBeTruthy()

    const pass = await swipe({ fromId: memberId, toId: people[21] ?? '', decision: 'PASS', now: morning })
    expect(pass.accepted, 'refuser un profil n’est jamais limité').toBe(true)
  })

  it('refuse un second super like le même jour', async () => {
    const city = uniqueCity('super')
    const memberId = await createMember({ city })
    const [first = '', second = ''] = await targets(city, 2)

    expect((await swipe({ fromId: memberId, toId: first, decision: 'SUPER_LIKE', now: morning })).accepted).toBe(true)
    const again = await swipe({ fromId: memberId, toId: second, decision: 'SUPER_LIKE', now: morning })
    expect(again.accepted).toBe(false)
    expect(again.reason).toBeTruthy()
    expect((await quota({ memberId, now: morning })).likesLeft, 'un super like ne compte pas dans les likes').toBe(20)
  })

  it('fait un match avec un super like comme avec un like', async () => {
    const city = uniqueCity('super-match')
    const [a = '', b = ''] = await targets(city, 2)
    await swipe({ fromId: a, toId: b, decision: 'SUPER_LIKE', now: morning })
    expect((await swipe({ fromId: b, toId: a, decision: 'LIKE', now: morning })).matched).toBe(true)
  })
})

describe('minuit à Madagascar', { timeout: 30_000 }, () => {
  // 20 h 59 UTC, c'est 23 h 59 à Antananarivo : la même journée.
  it('garde le compteur jusqu’à 23 h 59, et le remet à zéro à minuit, heure de Madagascar', async () => {
    const city = uniqueCity('minuit')
    const memberId = await createMember({ city })
    const people = await targets(city, 22)
    await likeAll(memberId, people.slice(0, 20), morning)

    const lateEvening = '2030-07-10T20:59:00.000Z'
    const midnight = '2030-07-10T21:00:00.000Z'
    expect((await quota({ memberId, now: lateEvening })).likesLeft).toBe(0)
    expect((await swipe({ fromId: memberId, toId: people[20] ?? '', decision: 'LIKE', now: lateEvening })).accepted).toBe(false)

    expect((await quota({ memberId, now: midnight })).likesLeft).toBe(20)
    expect((await swipe({ fromId: memberId, toId: people[21] ?? '', decision: 'LIKE', now: midnight })).accepted).toBe(true)
  })

  // 22 h 30 UTC le 10, c'est 1 h 30 le 11 à Antananarivo.
  it('range un like de 1 h 30 du matin dans la nouvelle journée', async () => {
    const city = uniqueCity('nuit')
    const memberId = await createMember({ city })
    const people = await targets(city, 3)
    await likeAll(memberId, people, '2030-07-10T22:30:00.000Z')

    expect((await quota({ memberId, now: '2030-07-10T20:00:00.000Z' })).likesLeft).toBe(20)
    expect((await quota({ memberId, now: '2030-07-10T23:00:00.000Z' })).likesLeft).toBe(17)
  })
})

describe('le Premium', { timeout: 30_000 }, () => {
  it('lève la limite des likes et donne cinq super likes', async () => {
    const city = uniqueCity('premium')
    const memberId = await createMember({ city })
    await grantPremium({ memberId, until: '2030-08-01T00:00:00.000Z' })
    const people = await targets(city, 22)

    const results = await likeAll(memberId, people, morning)
    expect(results.every((result) => result.accepted), 'un membre Premium like sans limite').toBe(true)
    expect(await quota({ memberId, now: morning })).toEqual({ likesLeft: null, superLikesLeft: 5 })
  })

  it('revient au quota gratuit une fois le Premium expiré', async () => {
    const memberId = await createMember()
    await grantPremium({ memberId, until: '2030-07-01T00:00:00.000Z' })
    expect(await quota({ memberId, now: morning })).toEqual({ likesLeft: 20, superLikesLeft: 1 })
  })
})
