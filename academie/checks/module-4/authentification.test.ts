/**
 * Module 4 : Mots de passe, âge et droits.
 *
 * Contrat attendu, exporté par `src/academie/module-4.ts` :
 *
 *   export class Member {
 *     static register(input: {
 *       email: string; name: string
 *       birthDate: string      // 'AAAA-MM-JJ'
 *       today: string          // 'AAAA-MM-JJ', la date du jour, passée en paramètre
 *     }): Member               // lève si le membre a moins de 18 ans
 *     readonly status: 'ACTIVE' | 'SUSPENDED'
 *     readonly suspensionReason: string | null
 *     suspend(reason: string): void      // lève si le motif est vide
 *     reinstate(): void
 *     canSwipe(): boolean
 *   }
 *
 *   export function hashPassword(plain: string): Promise<string>
 *   export function verifyPassword(plain: string, hash: string): Promise<boolean>
 *
 *   export type Role = 'MEMBER' | 'MODERATOR'
 *   export type Action = 'SWIPE' | 'SEND_MESSAGE' | 'EDIT_PROFILE' | 'MODERATE'
 *
 *   export function authorize(input: {
 *     roles: Role[]                         // [] pour un visiteur non connecté
 *     memberStatus?: 'ACTIVE' | 'SUSPENDED' // absent : ACTIVE
 *     action: Action
 *   }): { allowed: boolean; status: number }
 *
 * Un membre suspendu peut encore se connecter et corriger son profil
 * (`EDIT_PROFILE`). Il ne peut plus liker, écrire, ni modérer. Un compte peut
 * porter les deux rôles : membre et modérateur.
 *
 * `authorize` est la décision d'autorisation de votre serveur, isolée pour être
 * testable. Vos routes doivent l'appeler : masquer un bouton dans l'interface
 * n'est pas une autorisation.
 */
import { describe, expect, it } from 'vitest'
import { Member, authorize, hashPassword, verifyPassword } from '../../../src/academie/module-4'

const today = '2030-06-15'

function registered() {
  return Member.register({
    email: 'voahangy@example.org',
    name: 'Voahangy',
    birthDate: '1998-04-12',
    today,
  })
}

describe('l’inscription d’un membre', () => {
  it('crée un membre actif, qui peut liker', () => {
    const member = registered()
    expect(member.status).toBe('ACTIVE')
    expect(member.canSwipe()).toBe(true)
  })

  // L'application est réservée aux adultes, au jour près.
  it('refuse une personne qui a 18 ans demain', () => {
    expect(() =>
      Member.register({ email: 'jeune@example.org', name: 'Jeune', birthDate: '2012-06-16', today }),
    ).toThrow()
  })

  it('accepte une personne qui a 18 ans aujourd’hui', () => {
    const member = Member.register({
      email: 'majeur@example.org',
      name: 'Majeur',
      birthDate: '2012-06-15',
      today,
    })
    expect(member.status).toBe('ACTIVE')
  })
})

describe('la suspension', () => {
  it('empêche un membre suspendu de liker, avec un motif lisible', () => {
    const member = registered()
    member.suspend('Photos d’une autre personne')
    expect(member.status).toBe('SUSPENDED')
    expect(member.canSwipe()).toBe(false)
    expect(member.suspensionReason).toContain('Photos')
  })

  it('refuse une suspension sans motif', () => {
    expect(() => registered().suspend('  ')).toThrow()
  })

  it('rend ses droits à un membre réintégré', () => {
    const member = registered()
    member.suspend('Signalé par erreur')
    member.reinstate()
    expect(member.status).toBe('ACTIVE')
    expect(member.canSwipe()).toBe(true)
  })
})

describe('stockage des mots de passe', () => {
  it('ne conserve jamais le mot de passe en clair', async () => {
    const hash = await hashPassword('mot-de-passe-de-test-1')
    expect(hash).not.toContain('mot-de-passe-de-test-1')
    expect(hash.length).toBeGreaterThan(20)
  })

  // Un hachage sans sel se casse avec une table pré-calculée.
  it('sale le hachage : deux hachages du même mot de passe diffèrent', async () => {
    const [first, second] = await Promise.all([
      hashPassword('mot-de-passe-de-test-1'),
      hashPassword('mot-de-passe-de-test-1'),
    ])
    expect(first).not.toBe(second)
  })

  it('reconnaît le bon mot de passe et rejette le mauvais', async () => {
    const hash = await hashPassword('mot-de-passe-de-test-1')
    expect(await verifyPassword('mot-de-passe-de-test-1', hash)).toBe(true)
    expect(await verifyPassword('mot-de-passe-de-test-2', hash)).toBe(false)
  })
})

describe('autorisation côté serveur', () => {
  it('refuse un visiteur anonyme avec 401', () => {
    for (const action of ['SWIPE', 'SEND_MESSAGE', 'EDIT_PROFILE', 'MODERATE'] as const) {
      const decision = authorize({ roles: [], action })
      expect(decision.allowed, `un visiteur ne doit pas pouvoir ${action}`).toBe(false)
      expect(decision.status).toBe(401)
    }
  })

  it('laisse un membre actif liker, écrire et modifier son profil', () => {
    for (const action of ['SWIPE', 'SEND_MESSAGE', 'EDIT_PROFILE'] as const) {
      const decision = authorize({ roles: ['MEMBER'], memberStatus: 'ACTIVE', action })
      expect(decision.allowed, `un membre actif doit pouvoir ${action}`).toBe(true)
    }
  })

  it('refuse la modération à un simple membre avec 403', () => {
    const decision = authorize({ roles: ['MEMBER'], action: 'MODERATE' })
    expect(decision.allowed).toBe(false)
    expect(decision.status).toBe(403)
  })

  // Le cœur du module : être connecté ne suffit pas.
  it('refuse de liker et d’écrire à un membre suspendu, avec 403', () => {
    for (const action of ['SWIPE', 'SEND_MESSAGE'] as const) {
      const decision = authorize({ roles: ['MEMBER'], memberStatus: 'SUSPENDED', action })
      expect(decision.allowed, `un membre suspendu ne doit pas pouvoir ${action}`).toBe(false)
      expect(decision.status).toBe(403)
    }
  })

  it('laisse un membre suspendu corriger son profil', () => {
    const decision = authorize({
      roles: ['MEMBER'],
      memberStatus: 'SUSPENDED',
      action: 'EDIT_PROFILE',
    })
    expect(decision.allowed).toBe(true)
  })
})

describe('un compte, deux rôles', () => {
  it('laisse un membre modérateur actif tout faire', () => {
    for (const action of ['SWIPE', 'SEND_MESSAGE', 'EDIT_PROFILE', 'MODERATE'] as const) {
      const decision = authorize({ roles: ['MEMBER', 'MODERATOR'], memberStatus: 'ACTIVE', action })
      expect(decision.allowed, `un membre modérateur doit pouvoir ${action}`).toBe(true)
    }
  })

  it('refuse à un compte modérateur seul de liker', () => {
    const decision = authorize({ roles: ['MODERATOR'], action: 'SWIPE' })
    expect(decision.allowed).toBe(false)
    expect(decision.status).toBe(403)
  })

  it('retire la modération à un modérateur suspendu', () => {
    const decision = authorize({
      roles: ['MEMBER', 'MODERATOR'],
      memberStatus: 'SUSPENDED',
      action: 'MODERATE',
    })
    expect(decision.allowed).toBe(false)
    expect(decision.status).toBe(403)
  })
})
