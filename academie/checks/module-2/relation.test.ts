/**
 * Module 2 : Architecture, le cycle de vie d'une relation.
 *
 * Suite de conformité écrite par l'Académie. Elle appelle VOTRE code à travers
 * le fichier traducteur du module. Ces fichiers font partie du harnais : les
 * modifier confie votre remise à un mentor.
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts` :
 *
 *   export type ConnectionStatus =
 *     'PENDING' | 'MATCHED' | 'DECLINED' | 'UNMATCHED' | 'BLOCKED'
 *
 *   export class Connection {
 *     static like(input: {
 *       fromId: string          // le membre qui like
 *       toId: string            // le membre liké
 *     }): Connection            // lève si fromId === toId
 *     readonly status: ConnectionStatus
 *     readonly pairKey: string  // le même pour like(A, B) et like(B, A)
 *     transitionTo(next: ConnectionStatus): void   // lève si interdit
 *   }
 *
 * Une relation naît d'un like, en attente de la réponse de l'autre (PENDING).
 * Un like en retour en fait un match (MATCHED); un refus la ferme (DECLINED).
 * Un match peut être défait (UNMATCHED). N'importe quelle relation peut être
 * bloquée (BLOCKED), et rien ne sort d'un blocage.
 *
 * La paire se range dans un seul sens, le plus petit identifiant d'abord : un
 * match entre A et B est le même qu'entre B et A. Le module 12 en dépend.
 */
import { describe, expect, it } from 'vitest'
import { Connection } from '../../../src/academie/module-2'

const hery = '11111111-1111-4111-8111-111111111111'
const voahangy = '22222222-2222-4222-8222-222222222222'
const mialy = '33333333-3333-4333-8333-333333333333'

function pending() {
  return Connection.like({ fromId: hery, toId: voahangy })
}

function advanceTo(connection: Connection, steps: string[]) {
  for (const step of steps) connection.transitionTo(step as never)
}

describe('cycle de vie d’une relation', () => {
  it('naît en attente de la réponse de l’autre', () => {
    expect(pending().status).toBe('PENDING')
  })

  it('refuse qu’un membre se like lui-même', () => {
    expect(() => Connection.like({ fromId: hery, toId: hery })).toThrow()
  })

  it('devient un match quand l’autre like en retour', () => {
    const connection = pending()
    connection.transitionTo('MATCHED' as never)
    expect(connection.status).toBe('MATCHED')
  })

  it('laisse défaire un match', () => {
    const connection = pending()
    advanceTo(connection, ['MATCHED', 'UNMATCHED'])
    expect(connection.status).toBe('UNMATCHED')
  })

  it('refuse de refaire un match défait', () => {
    const connection = pending()
    advanceTo(connection, ['MATCHED', 'UNMATCHED'])
    expect(() => connection.transitionTo('MATCHED' as never)).toThrow()
  })

  it('refuse de transformer un refus en match', () => {
    const connection = pending()
    connection.transitionTo('DECLINED' as never)
    expect(() => connection.transitionTo('MATCHED' as never)).toThrow()
  })

  // Refuser répond à un like en attente; un match se défait, il ne se refuse pas.
  it('refuse de décliner un match', () => {
    const connection = pending()
    connection.transitionTo('MATCHED' as never)
    expect(() => connection.transitionTo('DECLINED' as never)).toThrow()
  })

  it('refuse de défaire un like qui n’est pas encore un match', () => {
    expect(() => pending().transitionTo('UNMATCHED' as never)).toThrow()
  })
})

describe('le blocage', () => {
  it('peut bloquer une relation en attente comme un match', () => {
    const waiting = pending()
    waiting.transitionTo('BLOCKED' as never)
    expect(waiting.status).toBe('BLOCKED')

    const matched = pending()
    advanceTo(matched, ['MATCHED', 'BLOCKED'])
    expect(matched.status).toBe('BLOCKED')
  })

  it('peut bloquer après un refus ou un match défait', () => {
    const declined = pending()
    advanceTo(declined, ['DECLINED', 'BLOCKED'])
    expect(declined.status).toBe('BLOCKED')

    const unmatched = pending()
    advanceTo(unmatched, ['MATCHED', 'UNMATCHED', 'BLOCKED'])
    expect(unmatched.status).toBe('BLOCKED')
  })

  it('ne laisse rien sortir d’un blocage', () => {
    for (const next of ['PENDING', 'MATCHED', 'DECLINED', 'UNMATCHED']) {
      const connection = pending()
      connection.transitionTo('BLOCKED' as never)
      expect(() => connection.transitionTo(next as never), `BLOCKED vers ${next}`).toThrow()
    }
  })
})

describe('la paire', () => {
  it('porte la même clé dans les deux sens', () => {
    const forward = Connection.like({ fromId: hery, toId: voahangy })
    const backward = Connection.like({ fromId: voahangy, toId: hery })
    expect(forward.pairKey, 'la clé de la paire doit exister').toBeTruthy()
    expect(backward.pairKey).toBe(forward.pairKey)
  })

  it('distingue deux paires différentes', () => {
    const first = Connection.like({ fromId: hery, toId: voahangy })
    const second = Connection.like({ fromId: hery, toId: mialy })
    expect(second.pairKey).not.toBe(first.pairKey)
  })
})
