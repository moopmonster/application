/**Insert new company**/               
 INSERT INTO Companies 
 (name, country, start_of_new_year, share_all_absences, ldap_auth_enabled, ldap_auth_config, date_format, company_wide_message, mode, timezone, integration_api_enabled, integration_api_token, carry_over, createdAt, updatedAt, gcal_id)
 VALUES 
 ("Merimen UAE","UAE",1,1,0,"","DD/MM/YYYY","",1,"Etc/GMT+4",0,"",10,date("now"),date("now"),null)
 /**insert new company**/

/**Copy leave type **/
insert into leaveTypes (name, color, use_allowance, `limit`, sort_order, comment_req, min_days_prior, attachment_req, is_adjustment, createdAt, updatedAt, companyId, is_include_weekend_and_hols, LeaveTypeCode )
select b.name, b.color, b.use_allowance,
case b.LeaveTypeCode
        WHEN 'ANNUAL' THEN 30
        WHEN 'SICK' THEN 15
        ELSE
             b.`limit`
END LeaveLimit
, b.sort_order, b.comment_req, b.min_days_prior, b.attachment_req, b.is_adjustment, b.createdAt, b.updatedAt, a.id, b.is_include_weekend_and_hols, b.LeaveTypeCode  
from companies a join 
(
  select name, color, use_allowance, `limit`, sort_order, comment_req, min_days_prior, attachment_req, is_adjustment
  , createdAt, updatedAt, companyId, is_include_weekend_and_hols, LeaveTypeCode 
  FROM leavetypes where companyid = 1
) b
where a.id = (select id from Companies where name = 'Merimen UAE')
order by a.id,b.sort_order
/**Copy leave type **/

/**Insert Department**/
INSERT INTO Departments
(name, allowance, include_public_holidays, is_accrued_allowance, createdAt, updatedAt, companyId, bossId, gcal_id)
VALUES
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen UAE"),1,null)
/**Insert Department**/

/**Insert new employee**/
INSERT INTO Users 
(email, password, name, lastname, activated, admin, auto_approve, start_date, end_date, user_leave, user_cf, global_adjuster, nickname, isManager, superadmin, createdAt, updatedAt, companyId, DepartmentId, calculated_userleaves, calculated_sickleaves)
VALUES 
('Ghaith@merimen.com','2e2098477eac12b441b441025fa07bb5','Mhd Ghaith','Mahmoud Aljamal',1,0,0,datetime('2020-09-01T00:00:00.000Z'),null,15,0,0,'Mhd Ghaith',0,0,date('now'),date('now'),(select id from companies where name = "Merimen UAE"),(select id from Departments where name = 'Project Management' and companyId = (select id from companies where name = "Merimen UAE")),30,15)
/**Insert new employee**/

/**Update Department Head**/
Update Departments set bossid = (Select id from Users Where email = 'sebastian@test.com') WHERE name = 'Project Management' AND companyId = (Select id from companies Where name = "Merimen UAE")
/**Update Department Head**/

/**Update user isManager flag**/
Update Users set isManager = 1 where id in (Select bossID from Departments UNION Select user_id from DepartmentSupervisor)
/**Update user isManager flag**/