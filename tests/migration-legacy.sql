-- Isolated CI fixture only. Never apply this file to a hosted project.
insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-0000-0000-000000000100','legacy@laudos.example.test','{"full_name":"Responsável legado"}');
insert into public.pilot_products(id,code,name,family,specifications) overriding system value values(-100,'LEGACY','Produto histórico','Resina','[{"name":"pH","unit":"","min":6,"max":8,"required":true}]');
insert into public.pilot_tanks(id,code,family) overriding system value values(-100,'LEGACY','Resina');
insert into public.pilot_cycles(id,tank_id,product_id,specifications,specification_version,manufactured_at,lots,reference_values,analyst,created_by) overriding system value
 values(-100,-100,-100,'[{"name":"pH","unit":"","min":6,"max":8,"required":true}]',1,now(),'L-LEGACY','["7"]','Responsável legado','00000000-0000-0000-0000-000000000100');
insert into public.pilot_loadings(id,cycle_id,plate,trailer,carrier,destination,analyst,loaded_at,values,source,state,certificate_number,issued_at,issued_by,created_by) overriding system value
 values(-100,-100,'LEG1234','Única','Transportadora histórica','Uberaba','Responsável legado',now(),'["7"]','own','Emitido','LEGACY-TEST',now(),'00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000100');

insert into public.pilot_loadings(id,cycle_id,plate,trailer,carrier,destination,analyst,loaded_at,values,source,state,certificate_number,issued_at,issued_by,created_by) overriding system value
 values(-101,-100,'OLD1234','Única','Transportadora histórica','Uberaba','Responsável legado',now(),'["7"]','ref','Aguardando autorização',null,null,null,'00000000-0000-0000-0000-000000000100'),
 (-102,-100,'OLD1235','Única','Transportadora histórica','Uberaba','Responsável legado',now(),'["7"]','ref','Emitido','LEGACY-APPROVED',now(),'00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000100');
insert into public.pilot_audit(actor_id,action,entity,entity_id,occurred_at) values
 ('00000000-0000-0000-0000-000000000100','solicitou autorização','loading',-101,now()-interval '1 minute'),
 ('00000000-0000-0000-0000-000000000100','solicitou autorização','loading',-102,now()-interval '1 minute');
insert into public.pilot_approvals(loading_id,edit_version,kind,decision,reason,actor_id)
 values(-102,1,'reuse','approved','Referências conferidas','00000000-0000-0000-0000-000000000100');
