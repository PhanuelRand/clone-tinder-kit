/**
 * Module 6 : Profil et photos.
 *
 * Contrat attendu, exporté par `src/academie/module-6.ts` :
 *
 *   export function createMember(): Promise<string>
 *                            // un membre majeur au courriel inventé, sans photo
 *
 *   export function updateProfile(input: {
 *     memberId: string; bio: string; interests: string[]
 *   }): Promise<{ status: number }>   // 200, ou 400 hors des limites
 *
 *   export function createUploadUrl(input: {
 *     memberId: string; contentType: string; sizeBytes: number
 *   }): Promise<
 *     | { url: string; key: string; expiresAt: string }   // ISO 8601
 *     | { refused: string }                               // motif lisible
 *   >
 *
 *   export function attachPhoto(input: {
 *     memberId: string; key: string
 *   }): Promise<{ attached: boolean; reason?: string }>
 *
 *   export function listPhotos(memberId: string): Promise<
 *     { key: string; position: number; isMain: boolean }[]
 *   >
 *
 *   export function setMainPhoto(input: {
 *     memberId: string; key: string
 *   }): Promise<void>
 *
 *   export function canAppearInDiscovery(memberId: string): Promise<{
 *     allowed: boolean; reason?: string
 *   }>
 *
 * Règles imposées par la consigne, que cette suite vérifie :
 *   - une bio fait 500 caractères au plus, et un profil a cinq centres
 *     d'intérêt au plus;
 *   - seuls `image/jpeg`, `image/png` et `image/webp` sont acceptés;
 *   - un fichier de plus de 10 000 000 octets est refusé;
 *   - l'URL de téléversement expire dans les deux heures;
 *   - un profil a six photos au plus, dont exactement une photo principale;
 *   - un profil sans photo n'apparaît pas dans la découverte.
 *
 * Les photos passent par votre port « stockage » : en local et dans ces
 * vérifications, un stockage simulé qui écrit sur le disque; en production,
 * Supabase Storage. Ces vérifications n'envoient aucun fichier : `attachPhoto`
 * n'a pas à vérifier que le fichier a bien été téléversé.
 */
import { describe, expect, it } from 'vitest'
import {
  attachPhoto,
  canAppearInDiscovery,
  createMember,
  createUploadUrl,
  listPhotos,
  setMainPhoto,
  updateProfile,
} from '../../../src/academie/module-6'

const maxBytes = 10_000_000

async function grantFor(memberId: string) {
  const grant = await createUploadUrl({ memberId, contentType: 'image/jpeg', sizeBytes: 250_000 })
  if (!('key' in grant)) throw new Error(`téléversement refusé : ${grant.refused}`)
  return grant
}

async function memberWithPhotos(count: number) {
  const memberId = await createMember()
  for (let index = 0; index < count; index += 1) {
    const grant = await grantFor(memberId)
    const result = await attachPhoto({ memberId, key: grant.key })
    if (!result.attached) throw new Error(`photo refusée : ${result.reason}`)
  }
  return memberId
}

describe('le texte du profil', () => {
  it('enregistre une bio et des centres d’intérêt', async () => {
    const memberId = await createMember()
    const result = await updateProfile({
      memberId,
      bio: 'Infirmière, toujours partante pour une randonnée.',
      interests: ['randonnée', 'cuisine'],
    })
    expect(result.status).toBe(200)
  })

  it('refuse une bio de plus de 500 caractères avec 400', async () => {
    const memberId = await createMember()
    const result = await updateProfile({ memberId, bio: 'a'.repeat(501), interests: [] })
    expect(result.status).toBe(400)
  })

  it('refuse plus de cinq centres d’intérêt avec 400', async () => {
    const memberId = await createMember()
    const result = await updateProfile({
      memberId,
      bio: 'Bonjour',
      interests: ['un', 'deux', 'trois', 'quatre', 'cinq', 'six'],
    })
    expect(result.status).toBe(400)
  })
})

describe('autorisation de téléversement', () => {
  it('accorde une URL signée pour une image', async () => {
    const memberId = await createMember()
    const grant = await createUploadUrl({ memberId, contentType: 'image/webp', sizeBytes: 250_000 })

    expect('key' in grant, 'une image valide doit être acceptée').toBe(true)
    if (!('key' in grant)) return
    expect(grant.url).toMatch(/^https?:\/\/.+/)
  })

  it('fait expirer l’URL dans les deux heures', async () => {
    const memberId = await createMember()
    const grant = await createUploadUrl({ memberId, contentType: 'image/png', sizeBytes: 100_000 })
    if (!('key' in grant)) throw new Error('téléversement refusé')

    const expiresAt = new Date(grant.expiresAt).getTime()
    expect(Number.isNaN(expiresAt), 'expiresAt doit être une date ISO 8601').toBe(false)
    expect(expiresAt).toBeGreaterThan(Date.now())
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 7_200_000)
  })

  // Le type est décidé côté serveur : un client peut annoncer ce qu'il veut.
  it('refuse un type de fichier qui n’est pas une image', async () => {
    const memberId = await createMember()
    for (const contentType of ['application/pdf', 'text/html', 'video/mp4']) {
      const grant = await createUploadUrl({ memberId, contentType, sizeBytes: 100_000 })
      expect('refused' in grant, `${contentType} doit être refusé`).toBe(true)
    }
  })

  it('refuse un fichier trop volumineux', async () => {
    const memberId = await createMember()
    const grant = await createUploadUrl({
      memberId,
      contentType: 'image/jpeg',
      sizeBytes: maxBytes + 1,
    })
    expect('refused' in grant, 'un fichier de plus de 10 Mo doit être refusé').toBe(true)
  })
})

describe('les photos d’un profil', () => {
  it('conserve les photos attachées, à des positions distinctes', async () => {
    const memberId = await memberWithPhotos(3)
    const photos = await listPhotos(memberId)

    expect(photos).toHaveLength(3)
    expect(new Set(photos.map((photo) => photo.position)).size).toBe(3)
  })

  it('désigne exactement une photo principale', async () => {
    const memberId = await memberWithPhotos(3)
    expect((await listPhotos(memberId)).filter((photo) => photo.isMain)).toHaveLength(1)
  })

  it('change de photo principale sans en créer une seconde', async () => {
    const memberId = await memberWithPhotos(3)
    const target = (await listPhotos(memberId)).find((photo) => !photo.isMain)
    expect(target, 'il faut au moins une photo secondaire').toBeDefined()
    if (!target) return

    await setMainPhoto({ memberId, key: target.key })
    const after = await listPhotos(memberId)
    expect(after.filter((photo) => photo.isMain)).toHaveLength(1)
    expect(after.find((photo) => photo.isMain)?.key).toBe(target.key)
  })

  it('refuse une septième photo, avec un motif', async () => {
    const memberId = await memberWithPhotos(6)
    const grant = await createUploadUrl({ memberId, contentType: 'image/jpeg', sizeBytes: 250_000 })
    const result =
      'key' in grant ? await attachPhoto({ memberId, key: grant.key }) : { attached: false, reason: grant.refused }

    expect(result.attached, 'six photos au plus').toBe(false)
    expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
    expect(await listPhotos(memberId)).toHaveLength(6)
  })

  it('refuse de reprendre la photo d’un autre membre', async () => {
    const owner = await memberWithPhotos(1)
    const thief = await createMember()
    const [photo] = await listPhotos(owner)
    expect(photo).toBeDefined()
    if (!photo) return

    const result = await attachPhoto({ memberId: thief, key: photo.key })
    expect(result.attached, 'une photo déjà rattachée ne doit pas être reprise').toBe(false)
  })
})

describe('la découverte', () => {
  it('cache un profil sans photo, avec un motif', async () => {
    const memberId = await createMember()
    const decision = await canAppearInDiscovery(memberId)

    expect(decision.allowed).toBe(false)
    expect(decision.reason, 'le refus doit porter un motif lisible').toBeTruthy()
  })

  it('montre un profil dès qu’il a une photo', async () => {
    const memberId = await memberWithPhotos(1)
    expect((await canAppearInDiscovery(memberId)).allowed).toBe(true)
  })
})
