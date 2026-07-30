import { SetMetadata } from "@nestjs/common";

export const SHOP_ACCESS_PARAM_KEY = "SHOP_ACCESS_PARAM_KEY";
export const ShopAccess = (paramKey = "shopId") => SetMetadata(SHOP_ACCESS_PARAM_KEY, paramKey);
