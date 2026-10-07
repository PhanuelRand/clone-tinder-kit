/**
 * Module 13 : La messagerie en temps réel, et le blocage.
 *
 * Deux membres qui ont matché se parlent, et un message envoyé apparaît chez
 * l'autre sans recharger la page. Deux règles font la différence entre une
 * messagerie et une fuite de données :
 *
 * - seuls les deux membres du match lisent la conversation, et le serveur le
 *   vérifie à chaque lecture, à chaque envoi et à chaque abonnement;
 * - un match défait ou un blocage ferme la conversation pour les deux. Un
 *   membre bloqué ne voit plus celui qui l'a bloqué, ne le revoit jamais dans
 *   sa découverte, et ne peut plus le liker.
 *
 * Contrat attendu, exporté par `src/academie/module-13.ts` :
 *
 *   export function createMember(input?: { ...ceux du module 7 }): Promise<string>
 *   export function discover(input: { viewerId; today; cursor?; limit? })   // module 7
 *   export function swipe(input: { fromId; toId; decision; now? })           // module 10
 *   export function listMatches(memberId: string)                            // module 9
 *   export function unmatch(input: { matchId; memberId })                    // module 9
 *
 *   export function createMatch(): Promise<{
 *     matchId: string; aId: string; bId: string
 *   }>                          // deux membres neufs qui se sont likés
 *
 *   export function sendMessage(input: {
 *     matchId: string; senderId: string; body: string
 *   }): Promise<{ status: number }>              // 201, 400 ou 403
 *
 *   export function readConversation(input: {
 *     matchId: string; readerId: string
 *   }): Promise<{
 *     status: number
 *     messages: { senderId: string; body: string; read: boolean }[]
 *   }>                          // read : le destinataire a lu ce message
 *
 *   export function markRead(input: {
 *     matchId: string; readerId: string
 *   }): Promise<{ status: number }>   // 200; 403 pour un tiers
 *                                     // marque lus les messages reçus de l'autre
 *
 *   export function unreadCount(memberId: string): Promise<number>
 *                             // messages reçus et pas encore lus, dans les matchs actifs
 *
 *   export function subscribe(input: {
 *     matchId: string; readerId: string
 *     onMessage: (message: { senderId: string; body: string }) => void
 *   }): Promise<{ status: number; unsubscribe: () => void }>
 *
 *   export function block(input: {
 *     blockerId: string; blockedId: string
 *   }): Promise<{ status: number }>              // 200 ou 201; 400 pour soi-même
 *
 * Un tiers reçoit 403 et aucun message; un abonnement refusé rend quand même
 * une fonction `unsubscribe`, qui ne fait rien. Un message vide, ou de plus de
 * 1 000 caractères, reçoit 400. Après un match défait ou un blocage, la lecture
 * et l'envoi répondent 403 aux deux membres.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  block,
  createMatch,
  createMember,
  discover,
  listMatches,
  markRead,
  readConversation,
  sendMessage,
  subscribe,
  swipe,
  unmatch,
  unreadCount,
} from '../../../src/academie/module-13'
import { todayInMadagascar } from '../_support/dates'

const today = todayInMadagascar()
let strangerId = ''

beforeAll(async () => {
  strangerId = await createMember()
})

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Attend un message diffusé, ou échoue au bout de trois secondes. */
function nextMessage(matchId: string, readerId: string) {
  return new Promise<{ senderId: string; body: string }>((resolveMessage, reject) => {
    const timer = setTimeout(() => reject(new Error('aucun message reçu en 3 s')), 3_000)
    void subscribe({
      matchId,
      readerId,
      onMessage: (message) => {
        clearTimeout(timer)
        resolveMessage(message)
      },
    }).then((subscription) => cleanups.push(subscription.unsubscribe))
  })
}

describe('entre les deux membres du match', () => {
  it('rend les messages aux deux membres, dans l’ordre d’envoi', async () => {
    const { matchId, aId, bId } = await createMatch()
    expect((await sendMessage({ matchId, senderId: aId, body: 'Bonjour !' })).status).toBe(201)
    await sendMessage({ matchId, senderId: bId, body: 'Bonjour, ça va ?' })

    for (const readerId of [aId, bId]) {
      const result = await readConversation({ matchId, readerId })
      expect(result.status).toBe(200)
      expect(result.messages.map((message) => message.body)).toEqual(['Bonjour !', 'Bonjour, ça va ?'])
      expect(result.messages.map((message) => message.senderId)).toEqual([aId, bId])
    }
  })

  it('refuse un message vide, ou trop long, avec 400', async () => {
    const { matchId, aId } = await createMatch()
    expect((await sendMessage({ matchId, senderId: aId, body: '   ' })).status).toBe(400)
    expect((await sendMessage({ matchId, senderId: aId, body: 'a'.repeat(1_001) })).status).toBe(400)
    expect((await readConversation({ matchId, readerId: aId })).messages).toEqual([])
  })
})

describe('fermée aux tiers', () => {
  it('refuse la lecture à un tiers avec 403, sans rien lui rendre', async () => {
    const { matchId, aId } = await createMatch()
    await sendMessage({ matchId, senderId: aId, body: 'Message privé' })

    const result = await readConversation({ matchId, readerId: strangerId })
    expect(result.status).toBe(403)
    expect(result.messages).toEqual([])
  })

  it('refuse l’envoi à un tiers avec 403', async () => {
    const { matchId, aId } = await createMatch()
    expect((await sendMessage({ matchId, senderId: strangerId, body: 'Intrus' })).status).toBe(403)
    expect((await readConversation({ matchId, readerId: aId })).messages).toEqual([])
  })

  it('refuse l’abonnement en temps réel à un tiers', async () => {
    const { matchId } = await createMatch()
    const subscription = await subscribe({ matchId, readerId: strangerId, onMessage: () => undefined })
    cleanups.push(subscription.unsubscribe)
    expect(subscription.status).toBe(403)
  })
})

describe('en temps réel', () => {
  it('diffuse un message à l’autre membre dès son envoi', async () => {
    const { matchId, aId, bId } = await createMatch()
    const received = nextMessage(matchId, bId)
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))

    await sendMessage({ matchId, senderId: aId, body: 'On se voit samedi ?' })
    expect((await received).body).toBe('On se voit samedi ?')
  })
})

describe('un match défait', () => {
  it('ferme la conversation pour les deux membres', async () => {
    const { matchId, aId, bId } = await createMatch()
    await sendMessage({ matchId, senderId: aId, body: 'Bonjour' })
    await unmatch({ matchId, memberId: bId })

    for (const memberId of [aId, bId]) {
      expect((await sendMessage({ matchId, senderId: memberId, body: 'Encore là ?' })).status).toBe(403)
      const read = await readConversation({ matchId, readerId: memberId })
      expect(read.status).toBe(403)
      expect(read.messages).toEqual([])
    }
  })
})

describe('le blocage', () => {
  it('ferme la conversation et retire le match des deux listes', async () => {
    const { matchId, aId, bId } = await createMatch()
    await sendMessage({ matchId, senderId: bId, body: 'Réponds-moi' })
    expect([200, 201]).toContain((await block({ blockerId: aId, blockedId: bId })).status)

    expect(await listMatches(aId)).toEqual([])
    expect(await listMatches(bId)).toEqual([])
    expect((await sendMessage({ matchId, senderId: bId, body: 'Pourquoi ?' })).status).toBe(403)
    expect((await readConversation({ matchId, readerId: bId })).status).toBe(403)
  })

  it('cache les deux membres de la découverte l’un de l’autre', async () => {
    const city = uniqueCity('blocage')
    const blocker = await createMember({ city })
    const blocked = await createMember({ city })
    const witness = await createMember({ city })
    await block({ blockerId: blocker, blockedId: blocked })

    const seenBy = async (viewerId: string) =>
      (await discover({ viewerId, today })).items.map((item) => item.memberId)
    expect(await seenBy(blocker)).not.toContain(blocked)
    expect(await seenBy(blocked)).not.toContain(blocker)
    expect(await seenBy(witness), 'les autres membres le voient toujours').toContain(blocked)
  })

  it('empêche le membre bloqué de liker celui qui l’a bloqué', async () => {
    const city = uniqueCity('blocage-like')
    const blocker = await createMember({ city })
    const blocked = await createMember({ city })
    await block({ blockerId: blocker, blockedId: blocked })

    const result = await swipe({ fromId: blocked, toId: blocker, decision: 'LIKE' })
    expect(result.accepted).toBe(false)
    expect(result.matched).toBe(false)
  })

  it('refuse de se bloquer soi-même, et accepte un second blocage sans erreur', async () => {
    const city = uniqueCity('blocage-double')
    const blocker = await createMember({ city })
    const blocked = await createMember({ city })

    expect((await block({ blockerId: blocker, blockedId: blocker })).status).toBe(400)
    await block({ blockerId: blocker, blockedId: blocked })
    expect([200, 201]).toContain((await block({ blockerId: blocker, blockedId: blocked })).status)
  })
})

describe('les messages non lus et l’accusé de lecture', () => {
  it('compte les messages non lus du destinataire, pas ceux de l’auteur', async () => {
    const { matchId, aId, bId } = await createMatch()
    await sendMessage({ matchId, senderId: aId, body: 'Bonjour' })
    await sendMessage({ matchId, senderId: aId, body: 'Tu es là ?' })

    expect(await unreadCount(bId)).toBe(2)
    expect(await unreadCount(aId)).toBe(0)
  })

  it('remet le compteur à zéro quand le destinataire lit, et le montre à l’auteur', async () => {
    const { matchId, aId, bId } = await createMatch()
    await sendMessage({ matchId, senderId: aId, body: 'Bonjour' })
    expect((await readConversation({ matchId, readerId: aId })).messages[0]?.read).toBe(false)

    expect((await markRead({ matchId, readerId: bId })).status).toBe(200)
    expect(await unreadCount(bId)).toBe(0)
    expect(
      (await readConversation({ matchId, readerId: aId })).messages[0]?.read,
      'l’auteur voit que son message a été lu',
    ).toBe(true)
  })

  it('ne marque pas lus les messages de celui qui lit', async () => {
    const { matchId, aId, bId } = await createMatch()
    await sendMessage({ matchId, senderId: aId, body: 'Bonjour' })
    await markRead({ matchId, readerId: aId })

    expect(await unreadCount(bId)).toBe(1)
  })

  it('refuse à un tiers de marquer une conversation comme lue, avec 403', async () => {
    const { matchId } = await createMatch()
    expect((await markRead({ matchId, readerId: strangerId })).status).toBe(403)
  })

  it('ne compte plus les messages d’un match défait', async () => {
    const { matchId, aId, bId } = await createMatch()
    await sendMessage({ matchId, senderId: aId, body: 'Bonjour' })
    await unmatch({ matchId, memberId: aId })

    expect(await unreadCount(bId)).toBe(0)
  })
})
