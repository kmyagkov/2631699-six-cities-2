import {
  inject,
  injectable,
} from 'inversify';
import {
  Request,
  Response,
} from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  BaseController,
  HttpMethod,
  HttpError,
  ValidateObjectIdMiddleware,
  ValidateDtoMiddleware,
  DocumentExistsMiddleware,
  PrivateRouteMiddleware,
} from '../../libs/rest/index.js';
import { Logger } from '../../libs/logger/index.js';
import { Component } from '../../types/index.js';
import { OfferService } from './offer-service.interface.js';
import { fillDTO } from '../../helpers/index.js';
import { DetailedOfferRdo } from './rdo/index.js';
import { OfferRdo } from '../../rdo/offer.rdo.js';
import {
  CreateOfferDto,
  UpdateOfferDto,
} from './dto/index.js';
import { ParamOfferId } from '../../types/param-offerId.type.js';
import { ParamCityId } from './type/param-city.type.js';
import { City } from '../../types/index.js';

@injectable()
export class OfferController extends BaseController {
  constructor(
    @inject(Component.Logger) protected readonly logger: Logger,
    @inject(Component.OfferService) protected readonly offerService: OfferService,
  ) {
    super(logger);

    this.logger.info('Register routes for OfferController…');

    this.addRoute({
      path: '/',
      method: HttpMethod.Get,
      handler: this.index,
    });
    this.addRoute({
      path: '/',
      method: HttpMethod.Post,
      handler: this.create,
      middlewares: [
        new PrivateRouteMiddleware(),
        new ValidateDtoMiddleware(CreateOfferDto),
      ],
    });
    this.addRoute({
      path: '/:offerId',
      method: HttpMethod.Get,
      handler: this.getDetail,
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        new DocumentExistsMiddleware(this.offerService, 'Offer', 'offerId'),
      ],
    });
    this.addRoute({
      path: '/:offerId',
      method: HttpMethod.Patch,
      handler: this.update,
      middlewares: [
        new PrivateRouteMiddleware(),
        new ValidateObjectIdMiddleware('offerId'),
        new ValidateDtoMiddleware(UpdateOfferDto),
        new DocumentExistsMiddleware(this.offerService, 'Offer', 'offerId'),
      ],
    });
    this.addRoute({
      path: '/:offerId',
      method: HttpMethod.Delete,
      handler: this.delete,
      middlewares: [
        new PrivateRouteMiddleware(),
        new ValidateObjectIdMiddleware('offerId'),
        new DocumentExistsMiddleware(this.offerService, 'Offer', 'offerId'),
      ],
    });
    this.addRoute({
      path: '/premium/:city',
      method: HttpMethod.Get,
      handler: this.getPremium,
    });
  }

  public async index({ tokenPayload }: Request, response: Response): Promise<void> {
    const offers = await this.offerService.find(tokenPayload?.id);
    this.ok(response, fillDTO(OfferRdo, offers));
  }

  public async create(
    {
      body,
      tokenPayload,
    }: Request<Record<string, unknown>, Record<string, unknown>, CreateOfferDto>,
    response: Response
  ): Promise<void> {
    const result = await this.offerService.create(body, tokenPayload.id);
    this.created(response, fillDTO(DetailedOfferRdo, result));
  }

  public async getDetail(
    {
      params,
      tokenPayload,
    }: Request<ParamOfferId>,
    response: Response
  ): Promise<void> {
    const { offerId } = params;
    const offer = await this.offerService.findById(tokenPayload?.id, offerId);
    this.ok(response, fillDTO(DetailedOfferRdo, offer));
  }

  public async update(
    {
      body,
      params,
      tokenPayload,
    }: Request<ParamOfferId, Record<string, unknown>, UpdateOfferDto>,
    response: Response,
  ): Promise<void> {
    const { offerId } = params;

    if (! await this.offerService.isOfferOwner(offerId, tokenPayload.id)) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        `Can't edit offer with id «${offerId}».`,
        'OfferController'
      );
    }

    const result = await this.offerService.updateById(tokenPayload.id, offerId, body);
    this.ok(response, fillDTO(DetailedOfferRdo, result));
  }

  public async delete(
    {
      params,
      tokenPayload,
    }: Request<ParamOfferId>,
    response: Response,
  ): Promise<void> {
    const { offerId } = params;

    if (! await this.offerService.isOfferOwner(offerId, tokenPayload.id)) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        `Can't delete offer with id «${offerId}».`,
        'OfferController'
      );
    }

    const result = await this.offerService.deleteById(tokenPayload.id, offerId);

    if (result) {
      this.noContent(response);
    } else {
      throw new HttpError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Failed to delete offer with id «${offerId}».`,
        'OfferController'
      );
    }
  }

  public async getPremium(
    {
      params,
      tokenPayload,
    }: Request<ParamCityId>,
    response: Response
  ): Promise<void> {
    const city = Object.values(City).includes(params.city as City)
      ? params.city as City
      : null;

    if (!city) {
      throw new HttpError(
        StatusCodes.NOT_FOUND,
        'Invalid city parameter',
        'OfferController'
      );
    }

    const offers = await this.offerService.findPremiumInCity(tokenPayload?.id, city);
    this.ok(response, fillDTO(OfferRdo, offers));
  }
}
