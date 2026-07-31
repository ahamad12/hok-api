import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors";
import type { ShopRepository } from "../../shop/repositories/shop.repository";
import { type ScratchPackResult, toScratchPackResult } from "../mappers/scratch-pack.mapper";
import type { ScratchGameRepository } from "../repositories/scratch-game.repository";
import type { ScratchPackRepository } from "../repositories/scratch-pack.repository";

export interface ReceiveScratchPackInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  gameId: string;
  serialStart: string;
  location: "DISPLAY" | "BACKSTOCK";
}

@Injectable()
export class ReceiveScratchPackUseCase {
  constructor(
    private readonly scratchPackRepository: ScratchPackRepository,
    private readonly scratchGameRepository: ScratchGameRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: ReceiveScratchPackInput): Promise<ScratchPackResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("You can only receive packs for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const game = await this.scratchGameRepository.findById(input.gameId);
    if (!game || game.shopId !== input.shopId || !game.isActive) {
      throw new NotFoundError("ScratchGame", input.gameId);
    }

    // Prevents the same physical pack (game + starting serial) from being
    // received twice, which would otherwise create two independently-
    // scanned rows for what is physically one pack.
    const existing = await this.scratchPackRepository.findByGameAndSerialStart(
      input.gameId,
      input.serialStart,
    );
    if (existing) {
      throw new ConflictError(
        "A pack with this serial start has already been received for this game",
      );
    }

    // STATE MACHINE: receive = immediately ACTIVE. Confirmed there's no
    // separate "warehouse, not yet on the floor" holding state — the
    // caller always knows the pack's location at receiving time.
    const pack = await this.scratchPackRepository.create({
      gameId: input.gameId,
      shopId: input.shopId,
      serialStart: input.serialStart,
      status: "ACTIVE",
      location: input.location,
      receivedById: input.requesterId,
      receivedAt: new Date(),
    });

    return toScratchPackResult(pack);
  }
}
