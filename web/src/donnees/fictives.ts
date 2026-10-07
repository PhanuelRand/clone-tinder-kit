/**
 * Des données fictives, pour construire vos écrans avant que l'API existe.
 *
 * Au module 3, vos pages lisent ce fichier. Dans les modules suivants, chaque
 * page le remplace par un appel à votre API, une page à la fois. Quand plus
 * aucun écran ne l'importe, supprimez-le.
 *
 * Les personnes, leurs profils et leurs messages sont inventés. Toutes sont
 * majeures : l'application est réservée aux adultes.
 */

export type Genre = 'WOMAN' | 'MAN' | 'NONBINARY'

export type ProfilFictif = {
  id: string
  prenom: string
  dateNaissance: string // 'AAAA-MM-JJ'; jamais montrée, on affiche l'âge
  genre: Genre
  ville: string
  bio: string
  centresInteret: string[]
  distanceKm: number // arrondie : la position exacte n'est jamais montrée
}

export const profilsFictifs: ProfilFictif[] = [
  {
    id: 'p1',
    prenom: 'Voahangy',
    dateNaissance: '1998-04-12',
    genre: 'WOMAN',
    ville: 'Antananarivo',
    bio: 'Infirmière, toujours partante pour une randonnée sur l’Ankaratra le dimanche.',
    centresInteret: ['randonnée', 'cuisine', 'photographie'],
    distanceKm: 3,
  },
  {
    id: 'p2',
    prenom: 'Tojo',
    dateNaissance: '1995-11-02',
    genre: 'MAN',
    ville: 'Antananarivo',
    bio: 'Développeur le jour, guitariste le soir. Je cherche quelqu’un pour découvrir les cafés d’Isoraka.',
    centresInteret: ['musique', 'café', 'football'],
    distanceKm: 5,
  },
  {
    id: 'p3',
    prenom: 'Mialy',
    dateNaissance: '2001-07-23',
    genre: 'WOMAN',
    ville: 'Antananarivo',
    bio: 'Étudiante en droit. J’aime les livres, le théâtre et les longues conversations.',
    centresInteret: ['lecture', 'théâtre', 'cuisine'],
    distanceKm: 1,
  },
  {
    id: 'p4',
    prenom: 'Andry',
    dateNaissance: '1990-02-28',
    genre: 'MAN',
    ville: 'Antananarivo',
    bio: 'Professeur de mathématiques. Le week-end, vélo et marché d’Analakely.',
    centresInteret: ['vélo', 'randonnée', 'jardinage'],
    distanceKm: 12,
  },
  {
    id: 'p5',
    prenom: 'Fara',
    dateNaissance: '1997-09-30',
    genre: 'NONBINARY',
    ville: 'Antananarivo',
    bio: 'Graphiste. Je dessine des affiches et je cherche des gens qui aiment les expositions.',
    centresInteret: ['dessin', 'photographie', 'musique'],
    distanceKm: 8,
  },
  {
    id: 'p6',
    prenom: 'Haja',
    dateNaissance: '1993-05-18',
    genre: 'MAN',
    ville: 'Antananarivo',
    bio: 'Cuisinier. Mon romazava est le meilleur de la ville, c’est en tout cas ce que dit ma mère.',
    centresInteret: ['cuisine', 'football', 'voyages'],
    distanceKm: 4,
  },
]

/**
 * Les photos d'un profil. Au module 3, elles n'existent pas encore : affichez
 * un cadre coloré avec l'initiale du prénom à leur place. La première photo
 * est la photo principale.
 */
export type PhotoFictive = { profilId: string; legende: string; principale: boolean }

export const photosFictives: PhotoFictive[] = [
  { profilId: 'p1', legende: 'Voahangy au sommet du Tsiafajavona', principale: true },
  { profilId: 'p1', legende: 'Un marché de Behoririka', principale: false },
  { profilId: 'p2', legende: 'Tojo et sa guitare', principale: true },
]

/** Votre propre profil, pour l'écran « Mon profil ». */
export const monProfilFictif: ProfilFictif & {
  recherche: Genre[]
  ageMin: number
  ageMax: number
  distanceMaxKm: number
} = {
  id: 'moi',
  prenom: 'Hery',
  dateNaissance: '1996-01-15',
  genre: 'MAN',
  ville: 'Antananarivo',
  bio: 'Comptable, amateur de basket et de cinéma.',
  centresInteret: ['basket', 'cinéma', 'cuisine'],
  distanceKm: 0,
  recherche: ['WOMAN'],
  ageMin: 24,
  ageMax: 35,
  distanceMaxKm: 15,
}

/**
 * Des matchs : deux personnes qui se sont likées l'une l'autre. Les statuts sont
 * ceux du module 2 : MATCHED tant que le match tient, UNMATCHED quand l'un des
 * deux l'a défait.
 */
export type MatchFictif = {
  id: string
  profilId: string
  creeLe: string // un instant, 'AAAA-MM-JJTHH:MM:SSZ'
  statut: 'MATCHED' | 'UNMATCHED'
}

export const matchsFictifs: MatchFictif[] = [
  { id: 'm1', profilId: 'p1', creeLe: '2030-07-08T17:42:00Z', statut: 'MATCHED' },
  { id: 'm2', profilId: 'p3', creeLe: '2030-07-09T09:15:00Z', statut: 'MATCHED' },
  { id: 'm3', profilId: 'p5', creeLe: '2030-07-10T19:03:00Z', statut: 'MATCHED' },
]

/** Les messages d'une conversation, dans l'ordre d'envoi. */
export type MessageFictif = {
  matchId: string
  auteur: 'moi' | 'autre'
  texte: string
  envoyeLe: string // un instant, 'AAAA-MM-JJTHH:MM:SSZ'
}

export const messagesFictifs: MessageFictif[] = [
  { matchId: 'm1', auteur: 'autre', texte: 'Bonjour Hery ! Tu fais aussi de la randonnée ?', envoyeLe: '2030-07-08T17:50:00Z' },
  { matchId: 'm1', auteur: 'moi', texte: 'Bonjour Voahangy, un peu. Jamais l’Ankaratra par contre.', envoyeLe: '2030-07-08T18:02:00Z' },
  { matchId: 'm1', auteur: 'autre', texte: 'Il faut absolument y aller, la vue est magnifique.', envoyeLe: '2030-07-08T18:05:00Z' },
  { matchId: 'm2', auteur: 'moi', texte: 'Tu as vu la pièce au CCESCA samedi ?', envoyeLe: '2030-07-09T10:00:00Z' },
]

/**
 * L'âge à une date donnée, en années entières. Une personne née un 29 février
 * prend un an le 1er mars les années qui n'en ont pas.
 *
 *   calculerAge('1998-04-12', '2030-04-11') === 31
 *   calculerAge('1998-04-12', '2030-04-12') === 32
 */
export function calculerAge(dateNaissance: string, aujourdhui: string): number {
  const [an, mois, jour] = dateNaissance.split('-').map(Number) as [number, number, number]
  const [anJ, moisJ, jourJ] = aujourdhui.split('-').map(Number) as [number, number, number]
  const anniversairePasse = moisJ > mois || (moisJ === mois && jourJ >= jour)
  return anJ - an - (anniversairePasse ? 0 : 1)
}

/** La date du jour à Madagascar, au format 'AAAA-MM-JJ'. */
export function aujourdhuiAMadagascar(): string {
  // 'en-CA' écrit les dates au format AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date())
}
