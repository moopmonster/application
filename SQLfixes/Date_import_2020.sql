/**Insert new company**/               
   INSERT INTO Companies 
    (name, country, start_of_new_year, share_all_absences, ldap_auth_enabled, ldap_auth_config, date_format, company_wide_message, mode, timezone, integration_api_enabled, integration_api_token, carry_over, createdAt, updatedAt, gcal_id)
   VALUES 
   ("Merimen Japan","JP",1,1,0,"","DD/MM/YYYY","",1,"Asia/Tokyo",0,"",10,date("now"),date("now"),null),
   ("Merimen Hong Kong","HK",1,1,0,"","DD/MM/YYYY","",1,"Asia/Hong_Kong",0,"",10,date("now"),date("now"),null)
   ("Merimen Philippines","PH",1,1,0,"","DD/MM/YYYY","",1,"Asia/Manila",0,"",10,date("now"),date("now"),null),
   ("Merimen Vietnam","VN",1,1,0,"","DD/MM/YYYY","",1,"Asia/Ho_Chi_Minh",0,"",10,date("now"),date("now"),null),
   ("Merimen Thailand","TH",1,1,0,"","DD/MM/YYYY","",1,"Asia/Bangkok",0,"",10,date("now"),date("now"),null),
   ("Merimen Singapore","SG",1,1,0,"","DD/MM/YYYY","",1,"Asia/Singapore",0,"",10,date("now"),date("now"),null),
   ("Merimen Indonesia","ID",1,1,0,"","DD/MM/YYYY","",1,"Asia/Jakarta",0,"",10,date("now"),date("now"),null)
 /**insert new company**/

/**Copy leave type **/
insert into leaveTypes (name, color, use_allowance, `limit`, sort_order, comment_req, min_days_prior, attachment_req, is_adjustment, createdAt, updatedAt, companyId, is_include_weekend_and_hols, LeaveTypeCode )
select b.name, b.color, b.use_allowance, b.`limit`, b.sort_order, b.comment_req, b.min_days_prior, b.attachment_req, b.is_adjustment, b.createdAt, b.updatedAt, a.id, b.is_include_weekend_and_hols, b.LeaveTypeCode  
from companies a join 
(
  select name, color, use_allowance, `limit`, sort_order, comment_req, min_days_prior, attachment_req, is_adjustment
  , createdAt, updatedAt, companyId, is_include_weekend_and_hols, LeaveTypeCode 
  FROM leavetypes where companyid = 1
) b left join leavetypes c on b.name = c.name 
where c.name not null and a.id <> 1
order by a.id,b.sort_order
/**Copy leave type **/

/**Insert Department**/
INSERT INTO Departments
(name, allowance, include_public_holidays, is_accrued_allowance, createdAt, updatedAt, companyId, bossId, gcal_id)
VALUES
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Japan"),1,null),
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Hong Kong"),1,null),
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Hong Kong"),1,null),
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),1,null),
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),1,null),
('Finance & Admin',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),1,null),
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),1,null),
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),1,null),
('Finance & Admin',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),1,null),
('Customer Support',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),1,null),
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),1,null),
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),1,null),
('Finance & Admin',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),1,null),
('Head of Department',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),1,null),
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),1,null),
('Finance & Admin',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),1,null),
('Customer Support',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),1,null),
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),1,null),
('Head of Department',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null),
('Project Management',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null),
('Finance & Admin-Head',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null),
('Finance & Admin',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null),
('Customer Support- Head',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null),
('Customer Support',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null),
('Business Development- Regional',0,1,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),1,null)
/**Insert Department**/

/**Insert new employee**/
INSERT INTO Users 
(email, password, name, lastname, activated, admin, auto_approve, start_date, end_date, user_leave, user_cf, global_adjuster, nickname, isManager, superadmin, createdAt, updatedAt, companyId, DepartmentId, calculated_userleaves, calculated_sickleaves)
VALUES 
('takeshi.taniguchi@merimen.com','2e2098477eac12b441b441025fa07bb5','Taniguchi','Takeshi',1,0,0,datetime('2019-08-01T00:00:00.000Z'),null,15,0,0,'Takeshi',0,0,date('now'),date('now'),(select id from companies where name = "Merimen Japan"),(select id from Departments where name = 'Business Development- Regional' and companyId = (select id from companies where name = "Merimen Japan")),15,null),
('eric@merimen.com','2e2098477eac12b441b441025fa07bb5','Tai','Chun Wai',1,0,0,datetime('2016-11-23T00:00:00.000Z'),null,15,0,0,'Eric',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Hong Kong"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Hong Kong")),15,null),
('zeng@merimen.com','2e2098477eac12b441b441025fa07bb5','Ng','Hok Fan',1,0,0,datetime('2017-05-01T00:00:00.000Z'),null,15,0,0,'Zeng',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Hong Kong"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Hong Kong")),15,null),
('bona.santiago@merimen.com','2e2098477eac12b441b441025fa07bb5','Santiago','Bona Grace Dizon',1,0,0,datetime('2016-05-02T00:00:00.000Z'),null,15,0,0,'Bona',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Philippines")),15,null),
('nathaniel.monterde@merimen.com','2e2098477eac12b441b441025fa07bb5','Monterde','Nathaniel Fadol',1,0,0,datetime('2016-07-18T00:00:00.000Z'),null,15,0,0,'Nathan',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Philippines")),15,null),
('roberto.consul@merimen.com','2e2098477eac12b441b441025fa07bb5','Consul','Roberto Diaz',1,0,0,datetime('2017-01-23T00:00:00.000Z'),null,15,0,0,'Aaron',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Philippines")),15,null),
('kimberley.alvarez@merimen.com','2e2098477eac12b441b441025fa07bb5','Alvarex','Kimberley Glorioso',1,0,0,datetime('2018-01-01T00:00:00.000Z'),null,15,0,0,'Kimberley',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Philippines"),(select id from Departments where name = 'Finance & Admin' and companyId = (Select id from companies Where name = "Merimen Philippines")),15,null),
('linh.nguyen@merimen.com','2e2098477eac12b441b441025fa07bb5','Thuy Linh ','Nguyen ',1,0,0,datetime('2017-07-01T00:00:00.000Z'),null,15,0,0,'Linh ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Finance & Admin' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('thien.do@merimen.com','2e2098477eac12b441b441025fa07bb5','Do Ngoc ','Truong Thien',1,0,0,datetime('2017-09-05T00:00:00.000Z'),null,15,0,0,'Thomas ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('yen.pham@merimen.com','2e2098477eac12b441b441025fa07bb5','Hong Yen','Pham',1,0,0,datetime('2018-06-04T00:00:00.000Z'),null,15,0,0,'Jallis',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('lily.mai@merimen.com','2e2098477eac12b441b441025fa07bb5','Thuy Linh','Mai ',1,0,0,datetime('2018-10-18T00:00:00.000Z'),null,15,0,0,'Lily',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('phuong.nguyen@merimen.com','2e2098477eac12b441b441025fa07bb5','Thi Thu Phuong','Nguyen ',1,0,0,datetime('2018-11-15T00:00:00.000Z'),null,15,0,0,'Gemi',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Customer Support' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('themy.le@merimen.com','2e2098477eac12b441b441025fa07bb5','The My','Le ',1,0,0,datetime('2019-08-12T00:00:00.000Z'),null,15,0,0,'Adrian',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('thanhyen.hua@merimen.com','2e2098477eac12b441b441025fa07bb5','Thi Thanh Yen','Hua ',1,0,0,datetime('2019-08-19T00:00:00.000Z'),null,15,0,0,'Lina',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Vietnam"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Vietnam")),15,null),
('jittarpon@merimen.com','2e2098477eac12b441b441025fa07bb5','Ongsunthornchai','Jittarpon ',1,0,0,datetime('2016-08-16T00:00:00.000Z'),null,15,0,0,'Jittarpon ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Thailand")),15,null),
('kesinee@merimen.com','2e2098477eac12b441b441025fa07bb5','Lakphet','Kesinee ',1,0,0,datetime('2018-06-01T00:00:00.000Z'),null,15,0,0,'Kesinee ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),(select id from Departments where name = 'Finance & Admin' and companyId = (Select id from companies Where name = "Merimen Thailand")),15,null),
('nutdanai@merimen.com','2e2098477eac12b441b441025fa07bb5','Watthanaseranee','Nutdanai ',1,0,0,datetime('2019-01-16T00:00:00.000Z'),null,15,0,0,'Banana',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Thailand")),15,null),
('parinya@merimen.com','2e2098477eac12b441b441025fa07bb5','Sritananun','Parinya ',1,0,0,datetime('2019-03-25T00:00:00.000Z'),null,15,0,0,'Parinya ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Thailand"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Thailand")),15,null),
('celeste@merimen.com','2e2098477eac12b441b441025fa07bb5','Chong ','Sheng Pey',1,0,0,datetime('2010-01-01T00:00:00.000Z'),null,15,0,0,'Celeste ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('bltan@merimen.com','2e2098477eac12b441b441025fa07bb5','Tan ','Bee Lian',1,0,0,datetime('2010-03-01T00:00:00.000Z'),null,15,0,0,'Bee Lian',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Finance & Admin' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('mary@merimen.com','2e2098477eac12b441b441025fa07bb5','Choo','Quek Soo ',1,0,0,datetime('2013-05-01T00:00:00.000Z'),null,15,0,0,'Mary',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Customer Support' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('bryan@merimen.com','2e2098477eac12b441b441025fa07bb5','Yu ','Chee Siang',1,0,0,datetime('2015-05-05T00:00:00.000Z'),null,15,0,0,'Bryan',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('sean@merimen.com','2e2098477eac12b441b441025fa07bb5','Leong ','Chee Kin',1,0,0,datetime('2015-08-11T00:00:00.000Z'),null,15,0,0,'Sean',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('annette@merimen.com','2e2098477eac12b441b441025fa07bb5','Choo ','Meow Ling ',1,0,0,datetime('2015-11-02T00:00:00.000Z'),null,15,0,0,'Annette',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('sebastian@merimen.com','2e2098477eac12b441b441025fa07bb5','Tan ','Yi Jie',1,0,0,datetime('2015-07-06T00:00:00.000Z'),null,15,0,0,'Sebastian',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('fabianlum@merimen.com','2e2098477eac12b441b441025fa07bb5','Lum ','Wai Kit',1,0,0,datetime('2015-03-02T00:00:00.000Z'),null,15,0,0,'Fabian',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Head of Department' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('hschia@merimen.com','2e2098477eac12b441b441025fa07bb5','Chia ','Hoe Seng',1,0,0,datetime('2019-10-01T00:00:00.000Z'),null,15,0,0,'Hoe Seng',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Singapore"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Singapore")),15,null),
('agus@merimen.com','2e2098477eac12b441b441025fa07bb5','Eka Budiman','Agustinus ',1,0,0,datetime('2006-10-16T00:00:00.000Z'),null,15,0,0,'Agus',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Head of Department' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('eva@merimen.com','2e2098477eac12b441b441025fa07bb5','Oktaviani','Eva ',1,0,0,datetime('2013-04-03T00:00:00.000Z'),null,15,0,0,'Eva ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Finance & Admin-Head' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('hude@merimen.com','2e2098477eac12b441b441025fa07bb5','Qizchi Sathria','Hude ',1,0,0,datetime('2016-01-04T00:00:00.000Z'),null,15,0,0,'Hude ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Customer Support' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('rizky@merimen.com','2e2098477eac12b441b441025fa07bb5','Anggia Irwanty','Rizky ',1,0,0,datetime('2015-05-25T00:00:00.000Z'),null,15,0,0,'Rizky ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Customer Support- Head' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('windi@merimen.com','2e2098477eac12b441b441025fa07bb5','Pramudia','Windi ',1,0,0,datetime('2008-07-01T00:00:00.000Z'),null,15,0,0,'Windi ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('rona@merimen.com','2e2098477eac12b441b441025fa07bb5','Gustina','Rona ',1,0,0,datetime('2017-03-01T00:00:00.000Z'),null,15,0,0,'Rona ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('tica@merimen.com','2e2098477eac12b441b441025fa07bb5','Shinta Octavia ','Tica ',1,0,0,datetime('2017-08-28T00:00:00.000Z'),null,15,0,0,'Tica ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('fiandara@merimen.com','2e2098477eac12b441b441025fa07bb5','Dwi Adityani','Fiandara ',1,0,0,datetime('2019-06-10T00:00:00.000Z'),null,15,0,0,'Rara',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Business Development- Regional' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('ajie@merimen.com','2e2098477eac12b441b441025fa07bb5','Dwi Setya Irawan','Ajie ',1,0,0,datetime('2019-07-01T00:00:00.000Z'),null,15,0,0,'Ajie ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Customer Support' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('shalahudin@merimen.com','2e2098477eac12b441b441025fa07bb5','Shalahudin','Muhammad ',1,0,0,datetime('2019-10-01T00:00:00.000Z'),null,15,0,0,'Shola',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Project Management' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null),
('clara@merimen.com','2e2098477eac12b441b441025fa07bb5','Hadijah Taha','Clara ',1,0,0,datetime('2019-11-25T00:00:00.000Z'),null,15,0,0,'Clara ',0,0,date('now'),date('now'),(Select id from companies Where name = "Merimen Indonesia"),(select id from Departments where name = 'Finance & Admin' and companyId = (Select id from companies Where name = "Merimen Indonesia")),15,null)
/**Insert new employee**/

/**Update Department Head**/
Update Departments set bossid = (Select id from Users Where email = 'fabianlum@merimen.com') WHERE name = 'Business Development- Regional' AND NOT companyId = (Select id from companies Where name = "Merimen Indonesia");
Update Departments set bossid = (Select id from Users Where email = 'eric@merimen.com') WHERE name = 'Project Management' AND companyId = (Select id from companies Where name = "Merimen Hong Kong");
Update Departments set bossid = (Select id from Users Where email = 'bona.santiago@merimen.com') WHERE name in ('Project Management','Finance & Admin') AND companyId = (Select id from companies Where name = "Merimen Philippines");
Update Departments set bossid = (Select id from Users Where email = 'themy.le@merimen.com') WHERE name in ('Project Management','Finance & Admin','Customer Support') AND companyId = (Select id from companies Where name = "Merimen Vietnam");
Update Departments set bossid = (Select id from Users Where email = 'jittarpon@merimen.com') WHERE name in ('Project Management','Finance & Admin') AND companyId = (Select id from companies Where name = "Merimen Thailand");
Update Departments set bossid = (Select id from Users Where email = 'thenghey@merimen.com') WHERE name in ('Head of Department') AND companyId = (Select id from companies Where name = "Merimen Singapore");
Update Departments set bossid = (Select id from Users Where email = 'thenghey@merimen.com') WHERE name in ('Head of Department') AND companyId = (Select id from companies Where name = "Merimen Indonesia");
Update Departments set bossid = (Select id from Users Where email = 'fabianlum@merimen.com') WHERE name in ('Project Management','Finance & Admin','Customer Support') AND companyId = (Select id from companies Where name = "Merimen Singapore");
Update Departments set bossid = (Select id from Users Where email = 'fabianlum@merimen.com') WHERE name in ('Project Management','Finance & Admin','Customer Support') AND companyId = (Select id from companies Where name = "Merimen Singapore");
Update Departments set bossid = (Select id from Users Where email = 'agus@merimen.com') WHERE name in ('Project Management','Finance & Admin-Head','Customer Support- Head','Business Development- Regional') AND companyId = (Select id from companies Where name = "Merimen Indonesia");
Update Departments set bossid = (Select id from Users Where email = 'eva@merimen.com') WHERE name in ('Finance & Admin') AND companyId = (Select id from companies Where name = "Merimen Indonesia");
Update Departments set bossid = (Select id from Users Where email = 'rizky@merimen.com') WHERE name in ('Customer Support') AND companyId = (Select id from companies Where name = "Merimen Indonesia");
/**Update Department Head**/

/**Update user isManager flag**/
Update Users set isManager = 1 where id in (Select bossID from Departments UNION Select user_id from DepartmentSupervisor)
/**Update user isManager flag**/