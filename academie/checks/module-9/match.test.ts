/**
 * Module 9 : Le like et le match.
 *
 * Un membre like ou passe chaque profil de sa découverte. Quand deux membres se
 * sont likés l'un l'autre, c'est un match : ils peuvent se parler.
 *
 * Les likes simultanés ne sont pas vérifiés ici, mais au module 12. C'est
 * voulu : une implémentation qui lit puis écrit passe cette suite et échoue
 * celle-là, et c'est ce que le module 12 apprend à diagnostiquer.
 *
 * Contrat attendu, exporté par `src/academie/module-9.ts` :
 *
 *   export function createMember(input?: { ...ceux du module 7 }): Promise<string>
 *   export function discover(input: { viewerId; today; cursor?; limit? })   // module 7
 *
 *   export function swipe(input: {
 *     fromId: string; toId: string
 *     decision: 'LIKE' | 'PASS'
 *   }): Promise<{
 *     accepted: boolean
 *     matched: boolean           // true quand ce like complète un like en retour
 *     matchId?: string           // présent quand matched est true
 *     reason?: string            // présent quand accepted est false
 *   }>
 *
 *   export function listMatches(memberId: string): Promise<
 *     { matchId: string; memberId: string }[]      // memberId : l'autre membre
 *   >
 *
 *   export function unmatch(input: {
 *     matchId: string; memberId: string
 *   }): Promise<{ status: number }>                // 200, ou 403 pour un tiers
 *
 * On ne revient pas sur un swipe : un second like ou un second refus sur le
 * même profil est refusé avec un motif. Un profil déjà swipé disparaît de la
 * découverte de celui qui l'a swipé. Un match défait disparaît des deux listes,
 * et ne se refait pas.
 */
import { describe, expect, it } from 'vitest'
import { createMember, discover, listMatches, swipe, unmatch } from '../../../src/academie/module-9'
import { todayInMadagascar } from '../_support/dates'

const today = todayInMadagascar()

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function pair() {
  const city = uniqueCity('paire')
  return { a: await createMember({ city }), b: await createMember({ city }), city }
}

async function matched() {
  const { a, b } = await pair()
  await swipe({ fromId: a, toId: b, decision: 'LIKE' })
  const result = await swipe({ fromId: b, toId: a, decision: 'LIKE' })
  if (!result.matchId) throw new Error('le like en retour aurait dû créer un match')
  return { a, b, matchId: result.matchId }
}

describe('le like', () => {
  it('accepte un premier like, sans match tant que l’autre n’a pas répondu', async () => {
    const { a, b } = await pair()
    const result = await swipe({ fromId: a, toId: b, decision: 'LIKE' })

    expect(result.accepted).toBe(true)
    expect(result.matched).toBe(false)
    expect(await listMatches(a)).toEqual([])
  })

  it('crée un match quand le like est réciproque', async () => {
    const { a, b } = await pair()
    await swipe({ fromId: a, toId: b, decision: 'LIKE' })
    const result = await swipe({ fromId: b, toId: a, decision: 'LIKE' })

    expect(result.matched).toBe(true)
    expect(result.matchId, 'un match porte un identifiant').toBeTruthy()
    expect(await listMatches(a)).toEqual([{ matchId: result.matchId, memberId: b }])
    expect(await listMatches(b)).toEqual([{ matchId: result.matchId, memberId: a }])
  })

  it('ne crée pas de match quand l’un des deux passe', async () => {
    const first = await pair()
    await swipe({ fromId: first.a, toId: first.b, decision: 'LIKE' })
    expect((await swipe({ fromId: first.b, toId: first.a, decision: 'PASS' })).matched).toBe(false)

    const second = await pair()
    await swipe({ fromId: second.b, toId: second.a, decision: 'PASS' })
    expect((await swipe({ fromId: second.a, toId: second.b, decision: 'LIKE' })).matched).toBe(false)

    expect(await listMatches(first.a)).toEqual([])
    expect(await listMatches(second.a)).toEqual([])
  })

  it('refuse qu’un membre se swipe lui-même, avec un motif', async () => {
    const { a } = await pair()
    const result = await swipe({ fromId: a, toId: a, decision: 'LIKE' })
    expect(result.accepted).toBe(false)
    expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
  })

  it('refuse un second swipe sur le même profil, avec un motif', async () => {
    const { a, b } = await pair()
    await swipe({ fromId: a, toId: b, decision: 'PASS' })

    const again = await swipe({ fromId: a, toId: b, decision: 'LIKE' })
    expect(again.accepted, 'on ne revient pas sur un refus').toBe(false)
    expect(again.reason).toBeTruthy()
  })
})

describe('la découverte après un swipe', () => {
  it('ne montre plus un profil déjà swipé, mais le montre encore aux autres', async () => {
    const city = uniqueCity('deja-vu')
    const viewer = await createMember({ city })
    const other = await createMember({ city })
    const target = await createMember({ city })

    await swipe({ fromId: viewer, toId: target, decision: 'PASS' })

    const seenByViewer = (await discover({ viewerId: viewer, today })).items.map((item) => item.memberId)
    const seenByOther = (await discover({ viewerId: other, today })).items.map((item) => item.memberId)
    expect(seenByViewer).not.toContain(target)
    expect(seenByOther).toContain(target)
  })
})

describe('défaire un match', () => {
  it('retire le match des deux listes', async () => {
    const { a, b, matchId } = await matched()
    expect((await unmatch({ matchId, memberId: a })).status).toBe(200)

    expect(await listMatches(a)).toEqual([])
    expect(await listMatches(b)).toEqual([])
  })

  // Côté serveur : connaître l'identifiant d'un match ne suffit pas à le défaire.
  it('refuse à un tiers de défaire un match, avec 403', async () => {
    const { a, matchId } = await matched()
    const stranger = await createMember()

    expect((await unmatch({ matchId, memberId: stranger })).status).toBe(403)
    expect(await listMatches(a)).toHaveLength(1)
  })

  it('ne laisse pas refaire un match défait', async () => {
    const { a, b, matchId } = await matched()
    await unmatch({ matchId, memberId: b })

    const again = await swipe({ fromId: a, toId: b, decision: 'LIKE' })
    expect(again.matched).toBe(false)
    expect(await listMatches(a)).toEqual([])
  })
})
