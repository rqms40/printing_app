import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private addressesService: AddressesService) {}

  @Get()
  getAddresses(@Request() req: RequestWithUser) {
    return this.addressesService.findByUser(req.user.sub);
  }

  @Post()
  createAddress(
    @Request() req: RequestWithUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.create(req.user.sub, dto);
  }

  @Put(':id')
  updateAddress(
    @Request() req: RequestWithUser,
    @Param('id') id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  deleteAddress(@Request() req: RequestWithUser, @Param('id') id: number) {
    return this.addressesService.remove(id, req.user.sub);
  }

  @Patch(':id/default')
  setDefault(@Request() req: RequestWithUser, @Param('id') id: number) {
    return this.addressesService.setDefault(id, req.user.sub);
  }
}
