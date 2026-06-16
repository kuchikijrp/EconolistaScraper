import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationRulesService } from './gamification-rules.service';

@Module({
  controllers: [GamificationController],
  providers: [GamificationService, GamificationRulesService],
  exports: [GamificationService, GamificationRulesService],
})
export class GamificationModule {}
