/**
 * Module 11 : Le paiement du Premium.
 *
 * Le prestataire de paiement est simulé : vous l'écrivez vous-même, dans votre
 * API. Il confirme les paiements et signe ses webhooks comme le ferait un vrai
 * prestataire, par exemple un service de Mobile Money. Aucun compte chez un
 * prestataire n'est nécessaire, et aucune carte bancaire.
 *
 * Chaque paiement réussi achète trente jours de Premium. Ils partent du moment
 * du paiement si le membre n'est pas Premium, et de la fin de son Premium en
 * cours s'il l'est : un membre qui renouvelle en avance ne perd aucun jour.
 *
 * Contrat attendu, exporté par `src/academie/module-11.ts` :
 *
 *   export function createMember(input?: { ...ceux du module 7 }): Promise<string>
 *
 *   export function capturePayment(input: {
 *     memberId: string; amount: number; idempotencyKey: string
 *     now: string                      // un instant ISO 8601
 *   }): Promise<{ chargeId: string; amount: number }>
 *
 *   export function listCharges(memberId: string): Promise<
 *     { chargeId: string; amount: number }[]
 *   >
 *
 *   export function subscription(input: {
 *     memberId: string; now: string
 *   }): Promise<{ premium: boolean; until: string | null }>   // until : instant ISO 8601
 *
 *   export function quota(input: { memberId: string; now: string })   // celle du module 10
 *
 *   export function signWebhook(payload: string): string
 *   export function handleWebhook(input: {
 *     payload: string; signature: string
 *   }): Promise<{ status: number }>
 *
 * Les montants sont des entiers, en ariary, qui n'a pas de centimes.
 *
 * `signWebhook` n'existe que pour permettre à cette suite de fabriquer une
 * signature valide. Votre serveur, lui, vérifie celle du prestataire.
 *
 * Un événement porte `{ id, type, memberId, amount, idempotencyKey, paidAt }`.
 * Un événement `payment.succeeded` correctement signé enregistre le débit sous
 * sa clé d'idempotence et prolonge le Premium, exactement comme
 * `capturePayment`. Un débit déjà enregistré sous cette clé ne se dédouble pas,
 * et ne prolonge rien une seconde fois.
 */
import { describe, expect, it } from 'vitest'
import {
  capturePayment,
  createMember,
  handleWebhook,
  listCharges,
  quota,
  signWebhook,
  subscription,
} from '../../../src/academie/module-11'

const price = 9_900
const paidAt = '2030-07-01T10:00:00.000Z'

function time(instant: string | null) {
  return instant === null ? Number.NaN : new Date(instant).getTime()
}

describe('l’encaissement', () => {
  it('débite une fois et rend le montant demandé', async () => {
    const memberId = await createMember()
    const charge = await capturePayment({ memberId, amount: price, idempotencyKey: `${memberId}-1`, now: paidAt })

    expect(charge.amount).toBe(price)
    expect(Number.isInteger(charge.amount)).toBe(true)
    expect(await listCharges(memberId)).toHaveLength(1)
  })

  // Un appel réseau qui échoue ne veut pas dire que rien ne s'est passé.
  it('ne double pas le débit quand la même clé est rejouée', async () => {
    const memberId = await createMember()
    const key = `${memberId}-1`
    const first = await capturePayment({ memberId, amount: price, idempotencyKey: key, now: paidAt })
    const replay = await capturePayment({ memberId, amount: price, idempotencyKey: key, now: paidAt })

    expect(replay.chargeId).toBe(first.chargeId)
    expect(await listCharges(memberId)).toHaveLength(1)
  })

  it('ne double pas le débit sous appels simultanés', async () => {
    const memberId = await createMember()
    const key = `${memberId}-1`
    await Promise.all(
      Array.from({ length: 4 }, () =>
        capturePayment({ memberId, amount: price, idempotencyKey: key, now: paidAt }),
      ),
    )
    expect(await listCharges(memberId)).toHaveLength(1)
  })
})

describe('les trente jours de Premium', () => {
  it('donne trente jours à partir du paiement', async () => {
    const memberId = await createMember()
    await capturePayment({ memberId, amount: price, idempotencyKey: `${memberId}-1`, now: paidAt })

    const during = await subscription({ memberId, now: '2030-07-31T09:59:00.000Z' })
    expect(during.premium).toBe(true)
    expect(time(during.until)).toBe(time('2030-07-31T10:00:00.000Z'))

    const after = await subscription({ memberId, now: '2030-07-31T10:01:00.000Z' })
    expect(after.premium).toBe(false)
  })

  it('n’est pas Premium sans paiement', async () => {
    const memberId = await createMember()
    expect(await subscription({ memberId, now: paidAt })).toEqual({ premium: false, until: null })
  })

  // Renouveler en avance ne fait perdre aucun jour.
  it('prolonge depuis la fin du Premium en cours', async () => {
    const memberId = await createMember()
    await capturePayment({ memberId, amount: price, idempotencyKey: `${memberId}-1`, now: paidAt })
    await capturePayment({
      memberId,
      amount: price,
      idempotencyKey: `${memberId}-2`,
      now: '2030-07-20T08:00:00.000Z',
    })

    const result = await subscription({ memberId, now: '2030-07-20T08:00:00.000Z' })
    expect(time(result.until)).toBe(time('2030-08-30T10:00:00.000Z'))
  })

  it('repart du jour du paiement après une expiration', async () => {
    const memberId = await createMember()
    await capturePayment({ memberId, amount: price, idempotencyKey: `${memberId}-1`, now: paidAt })
    await capturePayment({
      memberId,
      amount: price,
      idempotencyKey: `${memberId}-2`,
      now: '2030-09-01T12:00:00.000Z',
    })

    const result = await subscription({ memberId, now: '2030-09-01T12:00:00.000Z' })
    expect(time(result.until)).toBe(time('2030-10-01T12:00:00.000Z'))
  })

  it('ne prolonge pas deux fois pour un paiement rejoué', async () => {
    const memberId = await createMember()
    const key = `${memberId}-1`
    await capturePayment({ memberId, amount: price, idempotencyKey: key, now: paidAt })
    await capturePayment({ memberId, amount: price, idempotencyKey: key, now: paidAt })

    const result = await subscription({ memberId, now: paidAt })
    expect(time(result.until)).toBe(time('2030-07-31T10:00:00.000Z'))
  })

  it('lève la limite des likes du module 10', async () => {
    const memberId = await createMember()
    await capturePayment({ memberId, amount: price, idempotencyKey: `${memberId}-1`, now: paidAt })
    expect((await quota({ memberId, now: '2030-07-02T10:00:00.000Z' })).likesLeft).toBeNull()
  })
})

describe('les webhooks du prestataire', () => {
  function event(id: string, memberId: string, key = `${memberId}-1`) {
    return JSON.stringify({
      id,
      type: 'payment.succeeded',
      memberId,
      amount: price,
      idempotencyKey: key,
      paidAt,
    })
  }

  it('refuse un événement dont la signature est invalide', async () => {
    const memberId = await createMember()
    const response = await handleWebhook({ payload: event(`evt-${memberId}`, memberId), signature: 'inventee' })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
    expect(await listCharges(memberId)).toEqual([])
  })

  it('enregistre le débit et ouvre le Premium pour un événement correctement signé', async () => {
    const memberId = await createMember()
    const payload = event(`evt-${memberId}`, memberId)
    const response = await handleWebhook({ payload, signature: signWebhook(payload) })

    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(300)
    expect(await listCharges(memberId)).toHaveLength(1)
    expect((await subscription({ memberId, now: '2030-07-02T00:00:00.000Z' })).premium).toBe(true)
  })

  // Un prestataire redélivre ses événements : c'est normal, pas une anomalie.
  it('absorbe la redélivrance du même événement sans second effet', async () => {
    const memberId = await createMember()
    const payload = event(`evt-${memberId}`, memberId)
    const signature = signWebhook(payload)
    await handleWebhook({ payload, signature })
    await handleWebhook({ payload, signature })

    expect(await listCharges(memberId)).toHaveLength(1)
    expect(time((await subscription({ memberId, now: paidAt })).until)).toBe(time('2030-07-31T10:00:00.000Z'))
  })

  it('ne dédouble pas un paiement déjà encaissé sous la même clé', async () => {
    const memberId = await createMember()
    await capturePayment({ memberId, amount: price, idempotencyKey: `${memberId}-1`, now: paidAt })
    const payload = event(`evt-${memberId}`, memberId)
    await handleWebhook({ payload, signature: signWebhook(payload) })

    expect(await listCharges(memberId)).toHaveLength(1)
  })
})
