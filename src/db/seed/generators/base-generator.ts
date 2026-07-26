import { faker } from "@faker-js/faker";
import { ISeedAddress } from "../types";

/**
 * Pick a random element from a non‑empty array.
 * @throws {Error} if the array is empty.
 */
export const pickRandom = <T>(arr: T[]): T => {
  if (!arr || arr.length === 0) {
    throw new Error("Cannot pick a random element from an empty array.");
  }
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex] as T;
};

/**
 * Generate a random SKU with a given prefix and index (padded to 4 digits).
 */
export const generateSKU = (prefix: string, index: number): string =>
  `${prefix}-${String(index).padStart(4, "0")}`;

/**
 * Generate a realistic price in INR (rounded to nearest 10).
 */
export const generatePrice = (min = 300, max = 5000): number =>
  Math.round((Math.random() * (max - min) + min) / 10) * 10;

/**
 * Generate stock quantity between 0 and 200.
 */
export const generateStock = (): number =>
  faker.number.int({ min: 0, max: 200 });

/**
 * Generate a random discount (20% chance of 10–30%, else 0).
 */
export const generateDiscount = (): number =>
  Math.random() < 0.2 ? pickRandom([10, 15, 20, 25, 30]) : 0;

/**
 * Generate a random address.
 */
export const generateAddress = (isDefault = false): ISeedAddress => ({
  street: faker.location.streetAddress(),
  city: faker.location.city(),
  state: faker.location.state(),
  pincode: faker.location.zipCode("######"),
  label: pickRandom(["HOME", "WORK", "OTHER"]),
  isDefault,
});

/**
 * Image pools for each product type.
 */
export const IMAGE_POOLS = {
  APPAREL: [
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785012974/type-1.a_gytsuh.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785012974/type-1.b_av82lx.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785012974/type-1.c_kcnnof.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785012975/type-2.a_rrksdm.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785012975/type-2.b_gp03bc.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013032/type-2.c_c7hzcd.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013038/type-3.a_ppgpgh.jpg",
  ],
  BANGLE: [
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013107/type1-a_tzqh2m.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013108/type1-b_ktdlsx.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013107/type1.c_tuw6yq.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013111/type2.a_h6l9ya.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013112/type2.b_d668ih.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013113/type2.c_jklhat.jpg",
  ],
  FABRIC: [
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013197/type1-a_apnquu.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013198/type1-b_xbzkdf.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013225/type1-c_l6rrzm.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013226/type2-a_ciwdtw.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013226/type2-b_hnlkcj.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013253/type2-c_oagxm7.jpg",
  ],
  INNERWEAR: [
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013288/type-1.a_ncicm7.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013290/type-1.b_vnyulc.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013294/type-1.c_sy7gdv.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014001/type-2.a_noaf4o.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014003/type-2.b_jdkjqs.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014009/type-2.c_u2y2fd.jpg",
  ],
  ACCESSORY: [
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014293/type-1.a_hmttka.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014296/type-1.b_zakyhw.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014302/type-1.c_fabdmo.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014305/type-2.a_m0rwm8.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014307/type-2.b_p8y9o5.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014311/type-2.c_s5yyal.jpg",
    "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014311/type-2.d_r7z7eo.jpg",
  ],
};

//  COMBINED POOL – ALL PRODUCT IMAGES (for returns, etc.)

export const ALL_PRODUCT_IMAGES = [
  ...IMAGE_POOLS.APPAREL,
  ...IMAGE_POOLS.BANGLE,
  ...IMAGE_POOLS.FABRIC,
  ...IMAGE_POOLS.INNERWEAR,
  ...IMAGE_POOLS.ACCESSORY,
];

export const REVIEW_IMAGE_POOL = [
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013372/type-1.a_he3hxf.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013373/type-1.b_j4mzj7.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785013374/type-1.c_wsegw8.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014323/type-2.a_nij5nk.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014327/type-2.b_aeobx6.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014331/type-2.c_zzr445.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014332/type-3.a_tarv1r.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014337/type-3.b_wdbbiq.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014339/type-3.c_y62ptb.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785014344/type-4.a_n9yp7f.jpg",
];

export const AVATAR_POOL = [
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785015040/leetcode-profile_ot2bwk.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785015405/anime-boy-writing-by-window-sunset-illustration_ltqapw.jpg",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785015429/satoru-gojo-black-3840x2160-14684_jfih2w.png",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785015434/satoru-gojo-8k-3840x2160-15246_hqhdkj.png",
  "https://res.cloudinary.com/dl9bfojiu/image/upload/v1785015435/gogo_sataru_yohwyh.jpg",
];
