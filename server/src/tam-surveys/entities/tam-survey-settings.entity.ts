import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tam_survey_settings')
export class TamSurveySettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;
}
