/**
 * Module 12 : Diagnostic, le match perdu.
 *
 * Aux modules 9 et 10, vos likes ont passé toutes leurs vérifications. Elles
 * envoyaient les likes un par un. Celles-ci les envoient en même temps.
 *
 * Une implémentation qui lit puis écrit laisse une fenêtre entre les deux :
 *
 * - deux membres qui se likent au même instant lisent chacun « l'autre ne m'a
 *   pas encore liké », écrivent leur like, et aucun match n'est créé. Ou bien
 *   les deux voient le like de l'autre, et le match est créé deux fois;
 * - le même like envoyé cinq fois, par un double clic ou un réseau qui
 *   réessaie, peut s'enregistrer plusieurs fois;
 * - un membre gratuit qui envoie vingt-cinq likes d'un coup peut les voir tous
 *   passer : chaque demande a lu « il reste des likes » avant que les autres
 *   n'écrivent.
 *
 * Aucun test séquentiel ne voit ces défauts. La garantie doit venir de la base :
 * des contraintes d'unicité sur la paire (module 2, décision 0001), et un
 * verrou sur les membres concernés pendant la transaction du like.
 *
 * Contrat attendu, exporté par `src/academie/module-12.ts` : les fonctions des
 * modules 9 et 10, que vous réexportez.
 *
 *   export function createMember(input?: { ...ceux du module 7 }): Promise<string>
 *   export function swipe(input: {
 *     fromId: string; toId: string; decision: 'LIKE' | 'PASS' | 'SUPER_LIKE'; now?: string
 *   }): Promise<{ accepted: boolean; matched: boolean; matchId?: string; reason?: string }>
 *   export function listMatches(memberId: string): Promise<{ matchId: string; memberId: string }[]>
 *   export function quota(input: { memberId: string; now: string }): Promise<{
 *     likesLeft: number | null; superLikesLeft: number
 *   }>
 */
import { describe, expect, it } from 'vitest'
import { createMember, listMatches, quota, swipe } from '../../../src/academie/module-12'

const now = '2030-07-10T06:00:00.000Z'

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function members(city: string, count: number) {
  return Promise.all(Array.from({ length: count }, () => createMember({ city })))
}

describe('likes simultanés', { timeout: 60_000 }, () => {
  // Le test que seule une garantie de la base fait passer de façon fiable.
  it('crée exactement un match pour deux membres qui se likent au même instant', async () => {
    const city = uniqueCity('croises')
    const people = await members(city, 16)
    const pairs = Array.from({ length: 8 }, (_unused, index) => [
      people[index * 2] ?? '',
      people[index * 2 + 1] ?? '',
    ])

    await Promise.all(
      pairs.flatMap(([a = '', b = '']) => [
        swipe({ fromId: a, toId: b, decision: 'LIKE', now }),
        swipe({ fromId: b, toId: a, decision: 'LIKE', now }),
      ]),
    )

    for (const [a = '', b = ''] of pairs) {
      const matches = await listMatches(a)
      expect(matches, 'ni zéro match, ni deux : exactement un par paire').toHaveLength(1)
      expect(matches[0]?.memberId).toBe(b)
      expect(await listMatches(b)).toHaveLength(1)
    }
  })

  it('n’enregistre qu’une fois le même like envoyé cinq fois', async () => {
    const city = uniqueCity('double-clic')
    const [from = '', to = ''] = await members(city, 2)

    const results = await Promise.all(
      Array.from({ length: 5 }, () => swipe({ fromId: from, toId: to, decision: 'LIKE', now })),
    )

    expect(results.filter((result) => result.accepted)).toHaveLength(1)
    expect((await quota({ memberId: from, now })).likesLeft, 'un seul like décompté').toBe(19)
  })

  it('ne laisse passer que vingt likes sur vingt-cinq envoyés en même temps', async () => {
    const city = uniqueCity('rafale')
    const from = await createMember({ city })
    const targets = await members(city, 25)

    const results = await Promise.all(
      targets.map((to) => swipe({ fromId: from, toId: to, decision: 'LIKE', now })),
    )

    expect(results.filter((result) => result.accepted)).toHaveLength(20)
    expect((await quota({ memberId: from, now })).likesLeft).toBe(0)
  })
})
