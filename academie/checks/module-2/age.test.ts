/**
 * Module 2 : Architecture, l'âge.
 *
 * La base garde la date de naissance, jamais l'âge : un âge rangé est faux le
 * lendemain de l'anniversaire. L'âge se calcule avec la date du jour, passée en
 * paramètre plutôt que lue sur l'horloge. C'est ce qui permet de vérifier, ici,
 * qu'un membre a 17 ans la veille de ses 18 ans.
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts` :
 *
 *   export function ageOn(
 *     birthDate: string,   // 'AAAA-MM-JJ'
 *     today: string,       // 'AAAA-MM-JJ'
 *   ): number              // en années entières; lève si birthDate est après today
 *
 * Une personne née un 29 février prend un an le 1er mars les années qui n'ont
 * pas de 29 février.
 */
import { describe, expect, it } from 'vitest'
import { ageOn } from '../../../src/academie/module-2'

describe('le calcul de l’âge', () => {
  it('compte les années entières', () => {
    expect(ageOn('2000-06-15', '2030-06-14')).toBe(29)
    expect(ageOn('2000-06-15', '2030-06-15')).toBe(30)
    expect(ageOn('2000-06-15', '2030-12-31')).toBe(30)
  })

  // La règle qui compte le plus : la majorité, au jour près.
  it('a 17 ans la veille de ses 18 ans, et 18 le jour même', () => {
    expect(ageOn('2012-03-01', '2030-02-28')).toBe(17)
    expect(ageOn('2012-03-01', '2030-03-01')).toBe(18)
  })

  it('fait vieillir une personne née un 29 février le 1er mars', () => {
    expect(ageOn('2012-02-29', '2030-02-28')).toBe(17)
    expect(ageOn('2012-02-29', '2030-03-01')).toBe(18)
  })

  it('garde le 29 février les années bissextiles', () => {
    expect(ageOn('2012-02-29', '2032-02-28')).toBe(19)
    expect(ageOn('2012-02-29', '2032-02-29')).toBe(20)
  })

  it('rend un entier', () => {
    expect(Number.isInteger(ageOn('1999-08-20', '2030-01-10'))).toBe(true)
  })

  it('refuse une date de naissance dans le futur', () => {
    expect(() => ageOn('2031-01-01', '2030-01-01')).toThrow()
  })
})
