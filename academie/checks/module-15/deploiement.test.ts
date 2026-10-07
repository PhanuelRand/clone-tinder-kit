/**
 * Module 15 : Mise en production.
 *
 * Cette suite n'interroge pas votre code source : elle interroge **votre
 * application déployée**, à son adresse publique. C'est la preuve qu'elle
 * fonctionne vraiment, hors de votre machine.
 *
 * Elle ne crée rien et ne modifie rien : votre base de production ne reçoit
 * aucune donnée de vérification.
 *
 * Renseignez deux secrets dans les paramètres de votre dépôt GitHub (Settings,
 * puis Secrets and variables, puis Actions) :
 *
 *   DEPLOYMENT_URL   l'adresse de votre API, par exemple https://mon-api.onrender.com
 *   INTERFACE_URL    l'adresse de votre interface, par exemple https://mon-clone.onrender.com
 *
 * Contrat HTTP exigé :
 *
 *   GET  /health               -> 2xx
 *   GET  /discover             -> 401 sans session : la découverte demande d'être connecté
 *   POST /swipes               -> 401 sans session : liker aussi
 *   GET  /matches              -> 401 sans session : les matchs sont privés
 *   Une requête mal formée     -> 4xx, jamais 5xx
 *
 * Un hébergeur gratuit endort l'application après quelques minutes sans
 * visite : la première requête peut prendre près d'une minute. La suite
 * l'attend.
 */
import { describe, expect, it } from 'vitest'

const apiUrl = (process.env.DEPLOYMENT_URL ?? '').replace(/\/$/, '')
const interfaceUrl = (process.env.INTERFACE_URL ?? '').replace(/\/$/, '')
const timeout = 90_000

function call(url: string, init: RequestInit = {}): Promise<Response> {
  if (!/^https?:\/\//.test(url)) {
    throw new Error('Adresse manquante : renseignez les secrets DEPLOYMENT_URL et INTERFACE_URL.')
  }
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    // Un déploiement endormi doit se réveiller, mais pas bloquer la suite.
    signal: AbortSignal.timeout(timeout),
  })
}

describe('l’API déployée', () => {
  it('a une adresse configurée, servie en HTTPS', () => {
    expect(apiUrl, 'renseignez le secret DEPLOYMENT_URL avec l’adresse de votre API').toMatch(
      /^https:\/\/.+/,
    )
  })

  it('répond sur son point de santé', { timeout }, async () => {
    const response = await call(`${apiUrl}/health`)
    expect(response.ok).toBe(true)
  })
})

describe('les routes protégées', () => {
  // Une application de rencontres ne montre aucun profil à un visiteur anonyme.
  it('refuse la découverte sans session', { timeout }, async () => {
    const response = await call(`${apiUrl}/discover`)
    expect(response.status).toBe(401)
  })

  it('refuse de liker sans session', { timeout }, async () => {
    const response = await call(`${apiUrl}/swipes`, {
      method: 'POST',
      body: JSON.stringify({ toId: 'un-membre', decision: 'LIKE' }),
    })
    expect(response.status).toBe(401)
  })

  it('refuse la liste des matchs sans session', { timeout }, async () => {
    const response = await call(`${apiUrl}/matches`)
    expect(response.status).toBe(401)
  })

  it('répond à une requête mal formée par une erreur 4xx, jamais 5xx', { timeout }, async () => {
    const malformed = await call(`${apiUrl}/swipes`, { method: 'POST', body: '{ pas du json' })
    expect(malformed.status).toBeGreaterThanOrEqual(400)
    expect(malformed.status).toBeLessThan(500)

    const strange = await call(`${apiUrl}/discover?limit=beaucoup`)
    expect(strange.status).toBeLessThan(500)
  })
})

describe('l’interface déployée', () => {
  it('a une adresse configurée, servie en HTTPS', () => {
    expect(
      interfaceUrl,
      'renseignez le secret INTERFACE_URL avec l’adresse de votre interface',
    ).toMatch(/^https:\/\/.+/)
  })

  it('sert une page HTML', { timeout }, async () => {
    const response = await call(interfaceUrl, { headers: { Accept: 'text/html' } })
    expect(response.ok).toBe(true)
    expect(await response.text()).toMatch(/<html[\s>]/i)
  })
})
