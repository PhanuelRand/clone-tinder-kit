/**
 * Module 16 : Signalements et modération. Module Platine.
 *
 * Un membre peut signaler un profil : une personne qui semble mineure, du
 * harcèlement, un faux profil. Signaler bloque aussi, pour que la personne
 * signalée disparaisse aussitôt. Les signalements s'agrègent, et décident de
 * ce que voit la modération.
 *
 * Barème imposé, calculé sur les signalements d'un même membre. Un
 * signalement compte s'il a trente jours ou moins à la date `now`; un
 * signalement daté après `now` ne compte pas.
 *
 *   un signalement UNDERAGE qui compte               -> SUSPEND
 *   trois auteurs différents ou plus                 -> SUSPEND
 *   au moins un signalement qui compte               -> REVIEW
 *   sinon                                            -> NONE
 *
 * Plusieurs signalements du même auteur comptent pour un seul auteur.
 *
 * Contrat attendu, exporté par `src/academie/module-16.ts` :
 *
 *   export type ReportReason = 'UNDERAGE' | 'HARASSMENT' | 'FAKE_PROFILE' | 'SPAM' | 'OTHER'
 *
 *   export function moderationFor(input: {
 *     reports: { reporterId: string; reason: ReportReason; at: string }[]  // 'AAAA-MM-JJ'
 *     now: string                                                          // 'AAAA-MM-JJ'
 *   }): { action: 'NONE' | 'REVIEW' | 'SUSPEND' }
 *
 *   export function createMember(input?: {
 *     ...ceux du module 7
 *     roles?: ('MEMBER' | 'MODERATOR')[]      // par défaut ['MEMBER']
 *   }): Promise<string>
 *   export function discover(input: { viewerId; today; cursor?; limit? })   // module 7
 *   export function swipe(input: { fromId; toId; decision; now? })           // module 10
 *
 *   export function report(input: {
 *     reporterId: string; reportedId: string
 *     reason: string; comment: string
 *     at: string                               // 'AAAA-MM-JJ'
 *   }): Promise<{ status: number }>            // 201; 400 pour soi-même ou un motif inconnu
 *
 *   export function moderationQueue(input: {
 *     moderatorId: string; now: string
 *   }): Promise<{
 *     status: number                           // 200, ou 403 sans le rôle MODERATOR
 *     items: { memberId: string; action: 'REVIEW' | 'SUSPEND' }[]
 *   }>
 *
 *   export function reinstate(input: {
 *     moderatorId: string; memberId: string
 *   }): Promise<{ status: number }>            // 200, ou 403 sans le rôle MODERATOR
 *
 * Quand un signalement fait passer un membre à SUSPEND, il est suspendu
 * aussitôt : il ne peut plus liker (module 4) et disparaît de la découverte de
 * tous. Un modérateur peut le réintégrer.
 */
import { describe, expect, it } from 'vitest'
import {
  createMember,
  discover,
  moderationFor,
  moderationQueue,
  reinstate,
  report,
  swipe,
} from '../../../src/academie/module-16'
import { todayInMadagascar } from '../_support/dates'

// Le barème lit les dates des signalements; la découverte, la date du jour.
const now = '2030-07-31'
const today = todayInMadagascar()

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

describe('le barème de modération', () => {
  const cases: {
    label: string
    reports: { reporterId: string; reason: 'UNDERAGE' | 'HARASSMENT' | 'FAKE_PROFILE' | 'SPAM' | 'OTHER'; at: string }[]
    expected: 'NONE' | 'REVIEW' | 'SUSPEND'
  }[] = [
    { label: 'aucun signalement', reports: [], expected: 'NONE' },
    {
      label: 'un signalement récent',
      reports: [{ reporterId: 'a', reason: 'SPAM', at: '2030-07-30' }],
      expected: 'REVIEW',
    },
    {
      label: 'un signalement de trente jours tout juste',
      reports: [{ reporterId: 'a', reason: 'SPAM', at: '2030-07-01' }],
      expected: 'REVIEW',
    },
    {
      label: 'un signalement de trente et un jours',
      reports: [{ reporterId: 'a', reason: 'SPAM', at: '2030-06-30' }],
      expected: 'NONE',
    },
    {
      label: 'un signalement daté après aujourd’hui',
      reports: [{ reporterId: 'a', reason: 'SPAM', at: '2030-08-01' }],
      expected: 'NONE',
    },
    {
      label: 'un seul signalement pour une personne qui semble mineure',
      reports: [{ reporterId: 'a', reason: 'UNDERAGE', at: '2030-07-20' }],
      expected: 'SUSPEND',
    },
    {
      label: 'trois auteurs différents',
      reports: [
        { reporterId: 'a', reason: 'HARASSMENT', at: '2030-07-10' },
        { reporterId: 'b', reason: 'FAKE_PROFILE', at: '2030-07-15' },
        { reporterId: 'c', reason: 'OTHER', at: '2030-07-29' },
      ],
      expected: 'SUSPEND',
    },
    {
      label: 'trois signalements du même auteur',
      reports: [
        { reporterId: 'a', reason: 'HARASSMENT', at: '2030-07-10' },
        { reporterId: 'a', reason: 'HARASSMENT', at: '2030-07-15' },
        { reporterId: 'a', reason: 'HARASSMENT', at: '2030-07-29' },
      ],
      expected: 'REVIEW',
    },
    {
      label: 'trois auteurs, dont un signalement trop ancien',
      reports: [
        { reporterId: 'a', reason: 'HARASSMENT', at: '2030-05-01' },
        { reporterId: 'b', reason: 'HARASSMENT', at: '2030-07-15' },
        { reporterId: 'c', reason: 'HARASSMENT', at: '2030-07-29' },
      ],
      expected: 'REVIEW',
    },
  ]

  for (const scenario of cases) {
    it(`${scenario.label} : ${scenario.expected}`, () => {
      expect(moderationFor({ reports: scenario.reports, now }).action).toBe(scenario.expected)
    })
  }
})

describe('le signalement', () => {
  it('accepte un signalement, et refuse de se signaler soi-même ou un motif inconnu', async () => {
    const [reporter, reported] = [await createMember(), await createMember()]
    const base = { reporterId: reporter, reportedId: reported, comment: 'Faux profil', at: now }

    expect((await report({ ...base, reason: 'FAKE_PROFILE' })).status).toBe(201)
    expect((await report({ ...base, reportedId: reporter, reason: 'SPAM' })).status).toBe(400)
    expect((await report({ ...base, reason: 'PAS_SYMPA' })).status).toBe(400)
  })

  it('cache la personne signalée de la découverte de celui qui signale', async () => {
    const city = uniqueCity('signalement')
    const reporter = await createMember({ city })
    const reported = await createMember({ city })
    await report({ reporterId: reporter, reportedId: reported, reason: 'SPAM', comment: 'Publicité', at: now })

    const seen = (await discover({ viewerId: reporter, today })).items.map((item) => item.memberId)
    expect(seen).not.toContain(reported)
  })
})

describe('la suspension automatique', { timeout: 30_000 }, () => {
  async function reportedByThree(city: string) {
    const reported = await createMember({ city })
    for (let index = 0; index < 3; index += 1) {
      await report({
        reporterId: await createMember({ city }),
        reportedId: reported,
        reason: 'HARASSMENT',
        comment: 'Messages insistants',
        at: now,
      })
    }
    return reported
  }

  it('suspend un membre signalé par trois personnes : il ne peut plus liker', async () => {
    const city = uniqueCity('suspension')
    const reported = await reportedByThree(city)
    const target = await createMember({ city })

    const result = await swipe({ fromId: reported, toId: target, decision: 'LIKE' })
    expect(result.accepted).toBe(false)
    expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
  })

  it('cache un membre suspendu de la découverte de tous', async () => {
    const city = uniqueCity('suspendu-cache')
    const witness = await createMember({ city })
    const reported = await reportedByThree(city)

    const seen = (await discover({ viewerId: witness, today })).items.map((item) => item.memberId)
    expect(seen).not.toContain(reported)
  })

  it('ne suspend pas un membre signalé trois fois par la même personne', async () => {
    const city = uniqueCity('meme-auteur')
    const reporter = await createMember({ city })
    const reported = await createMember({ city })
    const target = await createMember({ city })
    for (let index = 0; index < 3; index += 1) {
      await report({ reporterId: reporter, reportedId: reported, reason: 'SPAM', comment: 'Encore', at: now })
    }

    expect((await swipe({ fromId: reported, toId: target, decision: 'LIKE' })).accepted).toBe(true)
  })
})

describe('la file de modération', { timeout: 30_000 }, () => {
  it('montre au modérateur les membres à examiner et ceux suspendus', async () => {
    const moderator = await createMember({ roles: ['MEMBER', 'MODERATOR'] })
    const reviewed = await createMember()
    await report({ reporterId: await createMember(), reportedId: reviewed, reason: 'SPAM', comment: 'Lien', at: now })
    const suspended = await createMember()
    await report({
      reporterId: await createMember(),
      reportedId: suspended,
      reason: 'UNDERAGE',
      comment: 'Dit avoir 16 ans',
      at: now,
    })

    const queue = await moderationQueue({ moderatorId: moderator, now })
    expect(queue.status).toBe(200)
    expect(queue.items).toContainEqual({ memberId: reviewed, action: 'REVIEW' })
    expect(queue.items).toContainEqual({ memberId: suspended, action: 'SUSPEND' })
  })

  it('refuse la file et la réintégration à un simple membre, avec 403', async () => {
    const member = await createMember()
    const queue = await moderationQueue({ moderatorId: member, now })
    expect(queue.status).toBe(403)
    expect(queue.items).toEqual([])
    expect((await reinstate({ moderatorId: member, memberId: member })).status).toBe(403)
  })

  it('laisse un modérateur réintégrer un membre suspendu', async () => {
    const city = uniqueCity('reintegration')
    const moderator = await createMember({ city, roles: ['MEMBER', 'MODERATOR'] })
    const suspended = await createMember({ city })
    const target = await createMember({ city })
    await report({ reporterId: moderator, reportedId: suspended, reason: 'UNDERAGE', comment: 'Doute', at: now })

    expect((await reinstate({ moderatorId: moderator, memberId: suspended })).status).toBe(200)
    expect((await swipe({ fromId: suspended, toId: target, decision: 'LIKE' })).accepted).toBe(true)
  })
})
